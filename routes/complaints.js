const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { verifyToken, isAdmin, isSupport } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    buildComplaintQuery,
    isValidStatusTransition,
    getAvailableTransitions,
    assignComplaint,
    reassignComplaint,
    unassignComplaint,
    getComplaintStats,
    autoAssignComplaint
} = require('../utils/complaintHelper');
const {
    calculateSLADeadline,
    getSLADurationMinutes,
    getSLAStatus,
    getSLAMetrics,
    updateSLADeadlineForPriorityChange,
    SLA_DEFINITIONS,
    getTimeUntilSLADeadline
} = require('../utils/slaHelper');
const {
    logComplaintCreated,
    logStatusChange,
    logAssignment,
    logReassignment,
    logUnassignment,
    logCommentAdded,
    logCommentDeleted,
    logPriorityChange,
    logComplaintDeleted
} = require('../utils/auditLogger');
const { detectPriority } = require('../utils/priorityDetector');
const {
    sendComplaintCreatedEmail,
    sendComplaintResolvedEmail,
    sendComplaintAssignedEmail,
    sendSupportTeamNewComplaintEmail,
    sendComplaintClosedEmail
} = require('../utils/emailService');
const { complaintLimiter } = require('../middleware/rateLimiter');

// @route   POST /api/complaints
// @desc    Create a new complaint (USER only)
// @access  Private (USER)
router.post('/', [
    verifyToken,
    authorize('USER'),
    complaintLimiter,
    upload.single('attachment'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').isIn(['Technical', 'Billing', 'Service', 'Product', 'Other']).withMessage('Invalid category')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, category, priority } = req.body;

        // Build attachment URL when a file was uploaded
        const attachmentUrl = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // ── Intelligent Priority Detection ──────────────────────────────
        // Analyze title and description to auto-detect priority
        const priorityDetection = detectPriority(title, description, priority || null);
        const detectedPriority = priorityDetection.priority;
        const now = new Date();

        const slaDuration = getSLADurationMinutes(detectedPriority);

        const complaint = new Complaint({
            userId: req.userId,
            title,
            description,
            category,
            priority: detectedPriority,
            attachmentUrl,
            slaDuration: slaDuration,
            slaDeadline: calculateSLADeadline(detectedPriority, now)
        });

        await complaint.save();
        await complaint.populate('userId', 'name email');

        // Auto-log creation event as a comment
        await new Comment({
            complaintId: complaint._id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: `Complaint created with priority: ${complaint.priority}`,
            text: `Complaint created with priority: ${complaint.priority}`,
            type: 'system'
        }).save();

        // Log audit event
        await logComplaintCreated(req.userId, complaint, req);

        // 🤖 Smart Auto-Assignment: assign to support agent with least workload
        let assignedAgent = null;
        try {
            assignedAgent = await autoAssignComplaint(complaint);
            if (assignedAgent) {
                await complaint.populate('assignedTo', 'name email role');

                // Log auto-assignment event as system comment
                await new Comment({
                    complaintId: complaint._id,
                    senderId: req.userId,
                    userId: req.userId,
                    senderRole: 'SYSTEM',
                    message: `Auto-assigned to ${assignedAgent.name} (least workload)`,
                    text: `Auto-assigned to ${assignedAgent.name} (least workload)`,
                    type: 'system'
                }).save();

                // 📧 Email support agent about new assignment
                sendComplaintAssignedEmail(assignedAgent.email, complaint).catch(() => {});
            }
        } catch (autoAssignErr) {
            console.warn('Auto-assign skipped:', autoAssignErr.message);
        }

        // 🔔 Emit Socket.io event to notify ALL support staff of new complaint
        const io = req.app.get('io');
        if (io) {
            io.emit('complaint:new', {
                _id: complaint._id,
                title: complaint.title,
                priority: complaint.priority,
                status: complaint.status,
                userId: complaint.userId,
                assignedTo: complaint.assignedTo || null,
                createdAt: complaint.createdAt
            });

            // Notify assigned agent via socket
            if (assignedAgent) {
                io.to(`user:${assignedAgent._id}`).emit('complaintAssigned', {
                    complaintId: complaint._id,
                    title: complaint.title,
                    priority: complaint.priority,
                    assignedAt: new Date().toISOString()
                });
            }
        }

        // 📧 Email support team about new complaint
        try {
            const supportUsers = await User.find({ role: 'SUPPORT' }).select('email');
            const supportEmails = supportUsers.map(u => u.email).filter(Boolean);
            await Promise.all(
                supportEmails.map(email => sendSupportTeamNewComplaintEmail(email, complaint))
            );
        } catch (emailErr) {
            console.warn('Support team email skipped:', emailErr.message);
        }

        // 📧 Email user confirmation
        const userEmail = complaint.userId?.email || req.user?.email;
        if (userEmail) {
            sendComplaintCreatedEmail(userEmail, complaint, priorityDetection).catch(() => {});
        }

        res.status(201).json({
            message: 'Complaint created successfully',
            complaint,
            autoAssigned: assignedAgent ? { name: assignedAgent.name, email: assignedAgent.email } : null,
            priorityDetection: {
                detectedPriority: priorityDetection.priority,
                detectionMethod: priorityDetection.detectedFrom,
                confidence: priorityDetection.confidence,
                note: priorityDetection.note,
                matchedKeywords: priorityDetection.keywords
            }
        });
    } catch (error) {
        console.error('Create complaint error:', error);
        res.status(500).json({ message: 'Server error while creating complaint' });
    }
});

// @route   GET /api/complaints
// @desc    Get complaints with role-based filtering, search, filter, pagination
// @access  Private
// Role-based behavior:
//   - USER: sees only their own complaints
//   - SUPPORT: sees only complaints assigned to them (status must be ASSIGNED or higher)
//   - ADMIN: sees all complaints
router.get('/', verifyToken, async (req, res) => {
    try {
        // Build role-based query filter
        let query = buildComplaintQuery(req.userId, req.user.role);

        // Search by title/description keyword
        if (req.query.search) {
            query.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (req.query.status && req.query.status !== 'ALL') {
            query.status = req.query.status;
        }

        // Filter by category
        if (req.query.category && req.query.category !== 'ALL') {
            query.category = req.query.category;
        }

        // Filter by priority
        if (req.query.priority && req.query.priority !== 'ALL') {
            query.priority = req.query.priority;
        }

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                const end = new Date(req.query.endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Sort
        const sortField = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortField]: sortOrder };

        const total = await Complaint.countDocuments(query);
        const complaints = await Complaint.find(query)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        res.json({
            complaints,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get complaints error:', error);
        res.status(500).json({ message: 'Server error while fetching complaints' });
    }
});

// @route   GET /api/complaints/:id
// @desc    Get single complaint by ID
// @access  Private
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email role');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only view their own complaints
        if (req.user.role === 'USER' && complaint.userId._id.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Support staff can view complaints assigned to them or unassigned complaints in the queue
        if (req.user.role === 'SUPPORT') {
            const isAssignedToSupport = complaint.assignedTo?._id.toString() === req.userId;
            const isUnassignedInQueue = !complaint.assignedTo && ['OPEN', 'ASSIGNED', 'ESCALATED'].includes(complaint.status);
            
            if (!isAssignedToSupport && !isUnassignedInQueue) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        // ADMIN can view all complaints (no restriction)

        res.json({ complaint });
    } catch (error) {
        console.error('Get complaint error:', error);
        res.status(500).json({ message: 'Server error while fetching complaint' });
    }
});

// @route   PUT /api/complaints/:id
// @desc    Update complaint status with workflow validation (USER, SUPPORT + ADMIN)
// @access  Private (USER can update own, SUPPORT/ADMIN can update any)
router.put('/:id', [
    verifyToken,
    body('status').optional().isIn(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { status, priority } = req.body;
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Authorization check:
        // - USER can only update their own complaints
        // - SUPPORT/ADMIN can update any complaint
        const isPrivileged = ['ADMIN', 'SUPPORT'].includes(req.user.role);
        if (req.user.role === 'USER') {
            if (complaint.userId.toString() !== req.userId) {
                return res.status(403).json({ message: 'Access denied - you can only update your own complaints' });
            }
        } else if (!isPrivileged) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const oldStatus = complaint.status;

        // Validate status transition if status is being updated
        if (status && status !== oldStatus) {
            if (!isPrivileged && !isValidStatusTransition(oldStatus, status)) {
                const available = getAvailableTransitions(oldStatus);
                return res.status(400).json({
                    message: `Invalid status transition from ${oldStatus}`,
                    currentStatus: oldStatus,
                    availableTransitions: available
                });
            }

            if (status === 'CLOSED' && !complaint.completionProofUrl) {
                return res.status(400).json({ message: 'Completion proof is required before closing the complaint' });
            }

            complaint.status = status;

            // Set closedAt if transitioning to CLOSED
            if (status === 'CLOSED') {
                complaint.closedAt = Date.now();
            }
        }

        if (priority) {
            complaint.priority = priority;
        }

        // Ensure complaint is assigned if transitioning from OPEN or ASSIGNED
        if (!complaint.assignedTo && (complaint.status === 'ASSIGNED' || complaint.status === 'IN_PROGRESS')) {
            complaint.assignedTo = req.userId;
            complaint.assignedAt = Date.now();
        }

        await complaint.save();
        await complaint.populate(['userId', 'assignedTo'], 'name email role');

        // Log status change to activity timeline
        if (status && status !== oldStatus) {
            await new Comment({
                complaintId: complaint._id,
                senderId: req.userId,
                userId: req.userId,
                senderRole: req.user.role,
                message: `Status changed from ${oldStatus} to ${status}`,
                text: `Status changed from ${oldStatus} to ${status}`,
                type: 'status_change',
                oldStatus,
                newStatus: status
            }).save();

            // Log audit event
            await logStatusChange(req.userId, complaint._id, complaint, oldStatus, status, req);

            // ── Real-time notification ──────────────────────────────
            const ownerId = complaint.userId._id
                ? complaint.userId._id.toString()
                : complaint.userId.toString();

            const io = req.app.get('io');
            if (io) {
                // Notify the complaint owner
                io.to(`user:${ownerId}`).emit('statusUpdated', {
                    complaintId: complaint._id,
                    title: complaint.title,
                    oldStatus,
                    newStatus: status,
                    updatedAt: new Date().toISOString()
                });
                console.log(`📡 Emitted statusUpdated → user:${ownerId} (${oldStatus} → ${status})`);

                // Broadcast to all clients (for admin/support dashboards)
                io.emit('complaint:statusUpdated', {
                    _id: complaint._id,
                    title: complaint.title,
                    oldStatus,
                    newStatus: status,
                    priority: complaint.priority,
                    category: complaint.category,
                    userId: complaint.userId,
                    assignedTo: complaint.assignedTo,
                    updatedAt: new Date().toISOString()
                });
            }

            // 📧 Send email only when complaint is CLOSED
            if (status === 'CLOSED') {
                const ownerEmail = complaint.userId?.email;
                if (ownerEmail) {
                    sendComplaintClosedEmail(ownerEmail, complaint).catch(() => {});
                }
            }
        }

        res.json({
            message: 'Complaint updated successfully',
            complaint,
            availableNextStatuses: getAvailableTransitions(complaint.status)
        });
    } catch (error) {
        console.error('Update complaint error:', error);
        res.status(500).json({ message: 'Server error while updating complaint' });
    }
});

// @route   POST /api/complaints/:id/proof
// @desc    Upload completion proof image (SUPPORT/ADMIN)
// @access  Private (SUPPORT, ADMIN)
router.post('/:id/proof', [
    verifyToken,
    upload.single('proof')
], async (req, res) => {
    try {
        if (!['SUPPORT', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Proof file is required' });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        const completionProofUrl = `/uploads/${req.file.filename}`;
        complaint.completionProofUrl = completionProofUrl;
        complaint.completionProofUploadedAt = Date.now();
        complaint.completionProofUploadedBy = req.userId;

        await complaint.save();
        await complaint.populate(['userId', 'assignedTo'], 'name email role');

        await new Comment({
            complaintId: complaint._id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: 'Completion proof uploaded',
            text: 'Completion proof uploaded',
            type: 'system'
        }).save();

        res.json({
            message: 'Completion proof uploaded successfully',
            complaint
        });
    } catch (error) {
        console.error('Upload proof error:', error);
        res.status(500).json({ message: 'Server error while uploading proof' });
    }
});

// @route   DELETE /api/complaints/:id
// @desc    Delete complaint (USER can delete their own, SUPPORT can delete any, ADMIN can delete any)
// @access  Private
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only delete their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await Complaint.findByIdAndDelete(req.params.id);
        // Also delete associated comments
        await Comment.deleteMany({ complaintId: req.params.id });

        // Log audit event
        await logComplaintDeleted(req.userId, req.params.id, complaint, req);

        res.json({ message: 'Complaint deleted successfully' });
    } catch (error) {
        console.error('Delete complaint error:', error);
        res.status(500).json({ message: 'Server error while deleting complaint' });
    }
});

/**
 * ─────────────────────────────────────────────────────────────────
 * ASSIGNMENT ENDPOINTS (ADMIN ONLY)
 * ─────────────────────────────────────────────────────────────────
 */

// @route   POST /api/complaints/:id/assign
// @desc    Assign complaint to a support user
// @access  Private (ADMIN ONLY)
router.post('/:id/assign', [
    verifyToken,
    isAdmin,
    body('supportUserId').notEmpty().withMessage('Support user ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { supportUserId } = req.body;

        const result = await assignComplaint(req.params.id, supportUserId, req.userId);

        // Log assignment event
        await new Comment({
            complaintId: req.params.id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: `Complaint assigned to ${result.complaint.assignedTo.name}`,
            text: `Complaint assigned to ${result.complaint.assignedTo.name}`,
            type: 'system'
        }).save();

        // Log audit event
        await logAssignment(req.userId, req.params.id, result.complaint, supportUserId, req);

        // Real-time notification to support agent
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${supportUserId}`).emit('complaintAssigned', {
                complaintId: req.params.id,
                title: result.complaint.title,
                priority: result.complaint.priority,
                assignedAt: new Date().toISOString()
            });
        }

        res.json({
            message: 'Complaint assigned successfully',
            complaint: result.complaint
        });
    } catch (error) {
        console.error('Assign complaint error:', error);
        res.status(400).json({ message: error.message || 'Error assigning complaint' });
    }
});

// @route   PUT /api/complaints/:id/reassign
// @desc    Reassign complaint to a different support user
// @access  Private (ADMIN ONLY)
router.put('/:id/reassign', [
    verifyToken,
    isAdmin,
    body('supportUserId').notEmpty().withMessage('Support user ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { supportUserId } = req.body;

        const result = await reassignComplaint(req.params.id, supportUserId, req.userId);

        // Log reassignment event
        await new Comment({
            complaintId: req.params.id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: `Complaint reassigned to ${result.complaint.assignedTo.name}`,
            text: `Complaint reassigned to ${result.complaint.assignedTo.name}`,
            type: 'system'
        }).save();

        // Log audit event
        await logReassignment(req.userId, req.params.id, result.complaint, result.oldAssignee, supportUserId, req);

        // Notify new assignee
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${supportUserId}`).emit('complaintAssigned', {
                complaintId: req.params.id,
                title: result.complaint.title,
                priority: result.complaint.priority,
                reassignedAt: new Date().toISOString()
            });
        }

        res.json({
            message: 'Complaint reassigned successfully',
            complaint: result.complaint,
            previousAssignee: result.oldAssignee
        });
    } catch (error) {
        console.error('Reassign complaint error:', error);
        res.status(400).json({ message: error.message || 'Error reassigning complaint' });
    }
});

// @route   DELETE /api/complaints/:id/unassign
// @desc    Unassign complaint (revert to OPEN)
// @access  Private (ADMIN ONLY)
router.delete('/:id/unassign', [verifyToken, isAdmin], async (req, res) => {
    try {
        const result = await unassignComplaint(req.params.id, req.userId);

        // Log unassignment event
        await new Comment({
            complaintId: req.params.id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: 'Complaint unassigned and reverted to OPEN status',
            text: 'Complaint unassigned and reverted to OPEN status',
            type: 'system'
        }).save();

        // Log audit event
        await logUnassignment(req.userId, req.params.id, result.complaint, result.unassignedFrom, req);

        res.json({
            message: 'Complaint unassigned successfully',
            complaint: result.complaint,
            unassignedFrom: result.unassignedFrom
        });
    } catch (error) {
        console.error('Unassign complaint error:', error);
        res.status(400).json({ message: error.message || 'Error unassigning complaint' });
    }
});

// @route   GET /api/complaints/stats/by-status
// @desc    Get complaint statistics by status (role-based)
// @access  Private
router.get('/stats/by-status', verifyToken, async (req, res) => {
    try {
        const stats = await getComplaintStats(req.userId, req.user.role);

        res.json({
            message: 'Complaint statistics retrieved',
            stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error while fetching statistics' });
    }
});

// @route   GET /api/complaints/:id/sla-status
// @desc    Get SLA status for a specific complaint
// @access  Private
router.get('/:id/sla-status', verifyToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id).populate('assignedTo', 'name email role');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Check access permissions
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.user.role === 'SUPPORT' && complaint.assignedTo?.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const slaStatus = getSLAStatus(complaint);

        res.json({
            message: 'SLA status retrieved',
            slaStatus
        });
    } catch (error) {
        console.error('Get SLA status error:', error);
        res.status(500).json({ message: 'Server error while fetching SLA status' });
    }
});

// @route   GET /api/complaints/sla/metrics
// @desc    Get SLA metrics and compliance statistics (ADMIN only)
// @access  Private (ADMIN)
router.get('/sla/metrics', verifyToken, isAdmin, async (req, res) => {
    try {
        const metrics = await getSLAMetrics();

        res.json({
            message: 'SLA metrics retrieved',
            metrics
        });
    } catch (error) {
        console.error('Get SLA metrics error:', error);
        res.status(500).json({ message: 'Server error while fetching SLA metrics' });
    }
});

/**
 * ─────────────────────────────────────────────────────────────────
 * COMMENT ENDPOINTS (nested under complaints)
 * ─────────────────────────────────────────────────────────────────
 */

// @route   GET  /api/complaints/:id/comments
// @desc    Fetch all chat-style comments for a complaint
// @access  Private
router.get('/:id/comments', verifyToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only view comments on their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Support can only view comments on assigned complaints
        if (req.user.role === 'SUPPORT' && complaint.assignedTo?.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const comments = await Comment.find({
            complaintId: req.params.id,
            type: 'comment'          // only real chat messages, not system events
        })
            .populate('senderId', 'name email role')
            .sort({ createdAt: 1 });

        res.json({ comments });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ message: 'Server error while fetching comments' });
    }
});

// @route   POST /api/complaints/:id/comments
// @desc    Add a chat comment to a complaint
// @access  Private
router.post('/:id/comments', [
    verifyToken,
    body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only comment on their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Support can only comment on assigned complaints
        if (req.user.role === 'SUPPORT' && complaint.assignedTo?.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied - you can only comment on assigned complaints' });
        }

        const comment = new Comment({
            complaintId: req.params.id,
            senderId: req.userId,
            userId: req.userId,          // backward-compat alias
            senderRole: req.user.role,   // 'USER' or 'SUPPORT'
            message: req.body.message,
            text: req.body.message,      // backward-compat alias
            type: 'comment'
        });

        await comment.save();
        await comment.populate('senderId', 'name email role');

        // Log audit event
        await logCommentAdded(req.userId, req.params.id, complaint, comment, req);

        // 🔔 Real-time: notify other party when a comment is added
        const io = req.app.get('io');
        if (io) {
            // Determine who should receive the notification
            // If sender is USER → notify assigned support
            // If sender is SUPPORT/ADMIN → notify complaint owner
            const recipients = [];

            if (req.user.role === 'USER' && complaint.assignedTo) {
                recipients.push(complaint.assignedTo.toString());
            } else if (['SUPPORT', 'ADMIN'].includes(req.user.role)) {
                recipients.push(complaint.userId.toString());
            }

            for (const recipientId of recipients) {
                io.to(`user:${recipientId}`).emit('newComment', {
                    complaintId: req.params.id,
                    title: complaint.title,
                    comment: {
                        message: comment.message,
                        senderName: comment.senderId?.name || req.user.name,
                        senderRole: comment.senderRole,
                        createdAt: comment.createdAt
                    }
                });
            }

            console.log(`💬 Emitted newComment for complaint ${req.params.id}`);
        }

        res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error while adding comment' });
    }
});

// @route   GET /api/complaints/priority-keywords
// @desc    Get keywords that trigger each priority level (for UI reference)
// @access  Public
router.get('/priority-keywords', (req, res) => {
    try {
        const { getKeywordPatterns } = require('../utils/priorityDetector');
        const patterns = getKeywordPatterns();

        res.json({
            message: 'Priority keyword patterns',
            patterns,
            info: {
                description: 'These keywords are used for intelligent priority detection during complaint creation',
                howItWorks: 'The system analyzes complaint title and description for these keywords and auto-assigns priority',
                note: 'Users can still manually override the detected priority if needed'
            }
        });
    } catch (error) {
        console.error('Error fetching priority keywords:', error);
        res.status(500).json({ message: 'Server error fetching keyword patterns' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SLA & ESCALATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// @route   GET /api/complaints/sla-breached
// @desc    List all SLA-breached complaints (deadline passed, not resolved)
// @access  Private (ADMIN, SUPPORT)
router.get('/sla-breached', [verifyToken, isSupport], async (req, res) => {
    try {
        const now = new Date();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {
            status: { $nin: ['RESOLVED', 'CLOSED'] },
            slaDeadline: { $lt: now }
        };

        // Support staff only see their assigned breached complaints
        if (req.user.role === 'SUPPORT') {
            query.$or = [
                { assignedTo: req.userId },
                { assignedTo: { $in: [null, undefined] } }
            ];
        }

        // Optional priority filter
        if (req.query.priority && req.query.priority !== 'ALL') {
            query.priority = req.query.priority;
        }

        const total = await Complaint.countDocuments(query);
        const complaints = await Complaint.find(query)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email role')
            .sort({ slaDeadline: 1 }) // Most overdue first
            .skip(skip)
            .limit(limit);

        // Add SLA info to each complaint
        const complaintsWithSLA = complaints.map(c => {
            const cObj = c.toObject();
            const slaInfo = getTimeUntilSLADeadline(c);
            return {
                ...cObj,
                slaInfo: {
                    isOverdue: true,
                    overdueDuration: slaInfo.overdueDuration,
                    percentage: slaInfo.percentage,
                    urgency: slaInfo.urgency
                }
            };
        });

        res.json({
            message: 'SLA-breached complaints retrieved',
            complaints: complaintsWithSLA,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Get SLA-breached error:', error);
        res.status(500).json({ message: 'Server error while fetching SLA-breached complaints' });
    }
});

// @route   GET /api/complaints/escalated
// @desc    List all escalated complaints
// @access  Private (ADMIN, SUPPORT)
router.get('/escalated', [verifyToken, isSupport], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {
            isEscalated: true,
            status: { $nin: ['RESOLVED', 'CLOSED'] }
        };

        // Support staff only see their assigned escalated complaints
        if (req.user.role === 'SUPPORT') {
            query.assignedTo = req.userId;
        }

        // Optional escalation level filter
        if (req.query.level) {
            query.escalationLevel = parseInt(req.query.level);
        }

        // Optional priority filter
        if (req.query.priority && req.query.priority !== 'ALL') {
            query.priority = req.query.priority;
        }

        const total = await Complaint.countDocuments(query);
        const complaints = await Complaint.find(query)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email role')
            .populate('escalationHistory.previousAssignee', 'name email')
            .populate('escalationHistory.newAssignee', 'name email')
            .sort({ escalatedAt: -1 }) // Most recently escalated first
            .skip(skip)
            .limit(limit);

        // Add SLA info
        const complaintsWithSLA = complaints.map(c => {
            const cObj = c.toObject();
            const slaInfo = getTimeUntilSLADeadline(c);
            return {
                ...cObj,
                slaInfo: {
                    isOverdue: slaInfo.isOverdue,
                    overdueDuration: slaInfo.overdueDuration || null,
                    timeRemaining: slaInfo.timeRemaining || null,
                    percentage: slaInfo.percentage,
                    urgency: slaInfo.urgency
                }
            };
        });

        res.json({
            message: 'Escalated complaints retrieved',
            complaints: complaintsWithSLA,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Get escalated complaints error:', error);
        res.status(500).json({ message: 'Server error while fetching escalated complaints' });
    }
});

// @route   GET /api/complaints/sla/definitions
// @desc    Get SLA definitions and configuration
// @access  Private
router.get('/sla/definitions', verifyToken, (req, res) => {
    res.json({
        message: 'SLA definitions retrieved',
        definitions: SLA_DEFINITIONS,
        maxEscalationLevel: 3,
        escalationSLAExtensionMinutes: 60
    });
});

// @route   POST /api/complaints/:id/escalate
// @desc    Manually escalate a complaint (ADMIN only)
// @access  Private (ADMIN)
// Manual escalation allows admins to escalate complaints immediately without waiting for SLA breach
router.post('/:id/escalate', [
    verifyToken,
    isAdmin,
    body('reason').optional().isString().trim(),
    body('notes').optional().isString().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { reason = 'MANUAL_ESCALATION', notes } = req.body;

        const complaint = await Complaint.findById(req.params.id)
            .populate('assignedTo', 'name email role')
            .populate('userId', 'name email');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Don't escalate if already resolved/closed
        if (['RESOLVED', 'CLOSED'].includes(complaint.status)) {
            return res.status(400).json({
                message: 'Cannot escalate resolved or closed complaints',
                currentStatus: complaint.status
            });
        }

        // Check if at max escalation level
        if (complaint.escalationLevel >= 3) {
            return res.status(400).json({
                message: 'Complaint has reached maximum escalation level',
                currentLevel: complaint.escalationLevel,
                maxLevel: 3
            });
        }

        // Perform escalation
        const escalatedComplaint = await escalateComplaint(req.params.id, {
            reason,
            escalatedBy: req.userId,
            notes: notes || 'Manually escalated by admin',
            req
        });

        if (!escalatedComplaint) {
            return res.status(400).json({ message: 'Escalation failed - complaint may already be at max level' });
        }

        await escalatedComplaint.populate(['userId', 'assignedTo'], 'name email role');

        // Log escalation as a comment
        await new Comment({
            complaintId: req.params.id,
            senderId: req.userId,
            userId: req.userId,
            senderRole: 'ADMIN',
            message: `🚨 MANUALLY ESCALATED to Level ${escalatedComplaint.escalationLevel}`,
            text: `Admin ${req.user.name} manually escalated complaint to Level ${escalatedComplaint.escalationLevel}. Reason: ${reason}. ${notes ? 'Notes: ' + notes : ''}`,
            type: 'escalation'
        }).save();

        // Real-time notification to new assignee
        const io = req.app.get('io');
        if (io) {
            const newAssignee = escalatedComplaint.assignedTo;
            if (newAssignee) {
                io.to(`user:${newAssignee._id}`).emit('complaintEscalated', {
                    complaintId: req.params.id,
                    title: escalatedComplaint.title,
                    priority: escalatedComplaint.priority,
                    escalationLevel: escalatedComplaint.escalationLevel,
                    escalatedAt: new Date().toISOString(),
                    assignedTo: newAssignee.name,
                    reason
                });
            }

            // Broadcast escalation event
            io.emit('complaint:escalated', {
                _id: req.params.id,
                title: escalatedComplaint.title,
                priority: escalatedComplaint.priority,
                escalationLevel: escalatedComplaint.escalationLevel,
                status: escalatedComplaint.status,
                assignedTo: escalatedComplaint.assignedTo,
                escalatedAt: new Date().toISOString()
            });
        }

        res.json({
            message: 'Complaint escalated successfully',
            complaint: escalatedComplaint,
            escalationDetails: {
                level: escalatedComplaint.escalationLevel,
                priority: escalatedComplaint.priority,
                assignedTo: escalatedComplaint.assignedTo,
                reason,
                escalatedAt: escalatedComplaint.escalatedAt
            }
        });
    } catch (error) {
        console.error('Manual escalation error:', error);
        res.status(500).json({ message: 'Server error while escalating complaint', error: error.message });
    }
});

module.exports = router;
