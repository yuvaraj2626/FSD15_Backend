const Complaint = require('../models/Complaint');
const User = require('../models/User');

/**
 * Build query filter based on user role
 * - USER: only their own complaints
 * - SUPPORT: complaints assigned to them + unassigned complaints (OPEN queue)
 * - ADMIN: all complaints
 */
const buildComplaintQuery = (userId, userRole) => {
    let query = {};

    if (userRole === 'USER') {
        // Users see only their own complaints
        query.userId = userId;
    } else if (userRole === 'SUPPORT') {
        // Support staff see:
        // 1. Complaints assigned to them
        // 2. OPEN/UNASSIGNED complaints (the support queue)
        query.$or = [
            { assignedTo: userId },  // Assigned to this support staff
            { 
                assignedTo: { $in: [null, undefined] },  // Unassigned complaints
                status: { $in: ['OPEN', 'ASSIGNED', 'ESCALATED'] }  // Actionable statuses
            }
        ];
    }
    // ADMIN sees all (no filter)

    return query;
};

/**
 * Workflow validation - ensures status transitions follow workflow
 * OPEN → ASSIGNED → ESCALATED (if SLA exceeded) → IN_PROGRESS → RESOLVED → CLOSED
 */
const isValidStatusTransition = (currentStatus, newStatus) => {
    // Define allowed transitions
    const transitions = {
        'OPEN': ['ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'ASSIGNED': ['ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'ESCALATED': ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'IN_PROGRESS': ['RESOLVED', 'CLOSED'],
        'RESOLVED': ['CLOSED'],
        'CLOSED': []
    };

    const allowedNextStatuses = transitions[currentStatus] || [];
    return allowedNextStatuses.includes(newStatus);
};

/**
 * Get status transition options from current status
 */
const getAvailableTransitions = (currentStatus) => {
    const transitions = {
        'OPEN': ['ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'ASSIGNED': ['ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'ESCALATED': ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        'IN_PROGRESS': ['RESOLVED', 'CLOSED'],
        'RESOLVED': ['CLOSED'],
        'CLOSED': []
    };

    return transitions[currentStatus] || [];
};

/**
 * Assign complaint to a support user
 * Only ADMIN can assign complaints
 */
const assignComplaint = async (complaintId, supportUserId, adminId) => {
    try {
        // Validate complaint exists
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            throw new Error('Complaint not found');
        }

        // Validate support user exists and has SUPPORT role
        const supportUser = await User.findById(supportUserId);
        if (!supportUser) {
            throw new Error('Support user not found');
        }
        if (supportUser.role !== 'SUPPORT') {
            throw new Error('Assigned user must have SUPPORT role');
        }

        // Check if already assigned to the same user
        if (complaint.assignedTo?.toString() === supportUserId) {
            throw new Error('Complaint already assigned to this support user');
        }

        // Update assignment
        complaint.assignedTo = supportUserId;
        complaint.assignedAt = new Date();

        // Update status to ASSIGNED if it's still OPEN
        if (complaint.status === 'OPEN') {
            complaint.status = 'ASSIGNED';
        }

        await complaint.save();

        return {
            success: true,
            complaint: await complaint.populate(['userId', 'assignedTo'], 'name email role')
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Reassign complaint to another support user
 * Only possible by ADMIN
 */
const reassignComplaint = async (complaintId, newSupportUserId, adminId) => {
    try {
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            throw new Error('Complaint not found');
        }

        // Validate new support user
        const supportUser = await User.findById(newSupportUserId);
        if (!supportUser || supportUser.role !== 'SUPPORT') {
            throw new Error('New assigned user must have SUPPORT role');
        }

        const oldAssignee = complaint.assignedTo;
        complaint.assignedTo = newSupportUserId;
        complaint.assignedAt = new Date();

        await complaint.save();

        return {
            success: true,
            complaint: await complaint.populate(['userId', 'assignedTo'], 'name email role'),
            oldAssignee,
            newAssignee: newSupportUserId
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Unassign complaint (revert to OPEN)
 * Only ADMIN can unassign
 */
const unassignComplaint = async (complaintId, adminId) => {
    try {
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            throw new Error('Complaint not found');
        }

        if (!complaint.assignedTo) {
            throw new Error('Complaint is not assigned to anyone');
        }

        const previousAssignee = complaint.assignedTo;
        complaint.assignedTo = null;
        complaint.assignedAt = null;

        // Revert status to OPEN
        complaint.status = 'OPEN';

        await complaint.save();

        return {
            success: true,
            complaint: await complaint.populate(['userId', 'assignedTo'], 'name email role'),
            unassignedFrom: previousAssignee
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Get complaint statistics by status and role
 */
const getComplaintStats = async (userId = null, userRole = null) => {
    try {
        const query = userRole ? buildComplaintQuery(userId, userRole) : {};

        const stats = await Complaint.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format stats
        const formatted = {
            OPEN: 0,
            ASSIGNED: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
            CLOSED: 0
        };

        stats.forEach(stat => {
            if (formatted.hasOwnProperty(stat._id)) {
                formatted[stat._id] = stat.count;
            }
        });

        return {
            ...formatted,
            total: Object.values(formatted).reduce((a, b) => a + b, 0)
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Smart Auto-Assignment
 * 
 * Automatically assigns a complaint to the support agent with the LEAST
 * active workload (fewest non-closed/resolved complaints).
 * 
 * Assignment priority:
 *   1. Support agents with 0 active complaints
 *   2. Support agent with fewest active complaints
 * 
 * @param {Object} complaint - Mongoose complaint document (must already be saved)
 * @returns {Object|null} - The assigned support user, or null if none available
 */
const autoAssignComplaint = async (complaint) => {
    try {
        // Get all non-blocked SUPPORT users
        const supportUsers = await User.find({ role: 'SUPPORT', blocked: { $ne: true } })
            .select('_id name email')
            .lean();

        if (supportUsers.length === 0) {
            console.log('⚠️  No support staff available for auto-assignment');
            return null;
        }

        // Count active complaints per support agent
        // Active = anything not RESOLVED or CLOSED
        const workload = await Complaint.aggregate([
            {
                $match: {
                    assignedTo: { $in: supportUsers.map(u => u._id) },
                    status: { $nin: ['RESOLVED', 'CLOSED'] }
                }
            },
            {
                $group: {
                    _id: '$assignedTo',
                    activeCount: { $sum: 1 }
                }
            }
        ]);

        // Build a workload map: userId → activeCount
        const workloadMap = new Map();
        workload.forEach(w => {
            workloadMap.set(w._id.toString(), w.activeCount);
        });

        // Find the agent with the least workload
        let bestAgent = null;
        let minWorkload = Infinity;

        for (const agent of supportUsers) {
            const count = workloadMap.get(agent._id.toString()) || 0;
            if (count < minWorkload) {
                minWorkload = count;
                bestAgent = agent;
            }
        }

        if (!bestAgent) return null;

        // Assign the complaint
        complaint.assignedTo = bestAgent._id;
        complaint.assignedAt = new Date();
        if (complaint.status === 'OPEN') {
            complaint.status = 'ASSIGNED';
        }
        await complaint.save();

        console.log(`🤖 Auto-assigned complaint ${complaint._id} → ${bestAgent.name} (workload: ${minWorkload})`);

        return bestAgent;
    } catch (error) {
        console.error('❌ Auto-assignment error:', error.message);
        return null;
    }
};

module.exports = {
    buildComplaintQuery,
    isValidStatusTransition,
    getAvailableTransitions,
    assignComplaint,
    reassignComplaint,
    unassignComplaint,
    getComplaintStats,
    autoAssignComplaint
};
