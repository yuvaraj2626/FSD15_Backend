const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const Comment = require('../models/Comment');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   POST /api/complaints
// @desc    Create a new complaint (USER only)
// @access  Private (USER)
router.post('/', [
    auth,
    authorize('USER'),
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

        const complaint = new Complaint({
            userId: req.userId,
            title,
            description,
            category,
            priority: priority || 'Medium',
            attachmentUrl
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

        res.status(201).json({
            message: 'Complaint created successfully',
            complaint
        });
    } catch (error) {
        console.error('Create complaint error:', error);
        res.status(500).json({ message: 'Server error while creating complaint' });
    }
});

// @route   GET /api/complaints
// @desc    Get complaints with search, filter, pagination
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let query = {};

        // Role filter
        if (req.user.role === 'USER') {
            query.userId = req.userId;
        }

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
router.get('/:id', auth, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only view their own complaints
        if (req.user.role === 'USER' && complaint.userId._id.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ complaint });
    } catch (error) {
        console.error('Get complaint error:', error);
        res.status(500).json({ message: 'Server error while fetching complaint' });
    }
});

// @route   PUT /api/complaints/:id
// @desc    Update complaint status (SUPPORT only)
// @access  Private (SUPPORT)
router.put('/:id', [
    auth,
    authorize('SUPPORT'),
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).withMessage('Invalid status')
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

        const oldStatus = complaint.status;

        if (status) {
            complaint.status = status;
            if (status === 'CLOSED') {
                complaint.closedAt = Date.now();
            }
        }

        if (priority) {
            complaint.priority = priority;
        }

        // Assign to support user if not already assigned
        if (!complaint.assignedTo) {
            complaint.assignedTo = req.userId;
        }

        await complaint.save();
        await complaint.populate('userId', 'name email');
        await complaint.populate('assignedTo', 'name email');

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

            // ── Real-time notification ──────────────────────────────
            // complaint.userId is populated at this point (name + email)
            const ownerId = complaint.userId._id
                ? complaint.userId._id.toString()
                : complaint.userId.toString();

            const io = req.app.get('io');
            if (io) {
                io.to(`user:${ownerId}`).emit('statusUpdated', {
                    complaintId: complaint._id,
                    title: complaint.title,
                    oldStatus,
                    newStatus: status,
                    updatedAt: new Date().toISOString()
                });
                console.log(`📡 Emitted statusUpdated → user:${ownerId} (${oldStatus} → ${status})`);
            }
        }

        res.json({
            message: 'Complaint updated successfully',
            complaint
        });
    } catch (error) {
        console.error('Update complaint error:', error);
        res.status(500).json({ message: 'Server error while updating complaint' });
    }
});

// @route   DELETE /api/complaints/:id
// @desc    Delete complaint (USER can delete their own, SUPPORT can delete any)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
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

        res.json({ message: 'Complaint deleted successfully' });
    } catch (error) {
        console.error('Delete complaint error:', error);
        res.status(500).json({ message: 'Server error while deleting complaint' });
    }
});

// ─────────────────────────────────────────────────────────────
// COMMENT ENDPOINTS  (nested under complaints)
// ─────────────────────────────────────────────────────────────

// @route   GET  /api/complaints/:id/comments
// @desc    Fetch all chat-style comments for a complaint
// @access  Private
router.get('/:id/comments', auth, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only view comments on their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
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
    auth,
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

        res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error while adding comment' });
    }
});

module.exports = router;

