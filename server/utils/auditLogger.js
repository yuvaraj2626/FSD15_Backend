/**
 * Audit Logging Utility
 * Provides functions to log all significant actions in the system
 */

const AuditLog = require('../models/AuditLog');

/**
 * Log an audit event
 * @param {Object} options - Audit logging options
 * @param {String} options.userId - ID of user performing the action
 * @param {String} options.userName - Name of user performing the action
 * @param {String} options.userRole - Role of user (USER, SUPPORT, ADMIN)
 * @param {String} options.action - Type of action performed
 * @param {String} options.complaintId - Associated complaint ID
 * @param {String} options.complaintTitle - Associated complaint title
 * @param {String} options.targetUserId - ID of affected user (if applicable)
 * @param {String} options.targetUserName - Name of affected user (if applicable)
 * @param {Object} options.details - Additional details about the action
 * @param {Object} options.changes - Before/after changes
 * @param {String} options.ipAddress - IP address of requester
 * @param {String} options.userAgent - User agent string
 * @param {String} options.status - SUCCESS or FAILED
 * @param {String} options.errorMessage - Error message if action failed
 * @returns {Promise<Object>} - Created audit log document
 */
async function logAudit(options = {}) {
    try {
        const auditLog = new AuditLog({
            userId: options.userId,
            userName: options.userName || null,
            userRole: options.userRole || null,
            action: options.action,
            complaintId: options.complaintId || null,
            complaintTitle: options.complaintTitle || null,
            targetUserId: options.targetUserId || null,
            targetUserName: options.targetUserName || null,
            details: options.details || {},
            changes: options.changes || {},
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
            status: options.status || 'SUCCESS',
            errorMessage: options.errorMessage || null,
            timestamp: new Date()
        });

        await auditLog.save();
        return auditLog;
    } catch (error) {
        console.error('Error logging audit:', error);
        // Don't throw - audit logging failures shouldn't break main functionality
        return null;
    }
}

/**
 * Log complaint creation
 */
async function logComplaintCreated(userId, complaint, req) {
    return logAudit({
        userId: complaint.userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'USER',
        action: 'COMPLAINT_CREATED',
        complaintId: complaint._id,
        complaintTitle: complaint.title,
        details: {
            category: complaint.category,
            priority: complaint.priority,
            description: complaint.description
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log status change
 */
async function logStatusChange(userId, complaintId, complaint, oldStatus, newStatus, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'USER',
        action: 'STATUS_CHANGED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        details: {
            priority: complaint?.priority || null,
            category: complaint?.category || null
        },
        changes: {
            before: { status: oldStatus },
            after: { status: newStatus }
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log complaint assignment
 */
async function logAssignment(userId, complaintId, complaint, supportUserId, supportUserName, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'ASSIGNED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        targetUserId: supportUserId,
        targetUserName: supportUserName || null,
        details: {
            priority: complaint?.priority || null,
            category: complaint?.category || null,
            assignedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log complaint reassignment
 */
async function logReassignment(userId, complaintId, complaint, oldSupportUserId, newSupportUserId, oldSupportName, newSupportName, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'REASSIGNED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        targetUserId: newSupportUserId,
        targetUserName: newSupportName || null,
        details: {
            priority: complaint?.priority || null,
            category: complaint?.category || null,
            reassignedAt: new Date()
        },
        changes: {
            before: { assignedTo: oldSupportUserId, assignedToName: oldSupportName },
            after: { assignedTo: newSupportUserId, assignedToName: newSupportName }
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log complaint unassignment
 */
async function logUnassignment(userId, complaintId, complaint, supportUserId, supportUserName, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'UNASSIGNED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        targetUserId: supportUserId,
        targetUserName: supportUserName || null,
        details: {
            priority: complaint?.priority || null,
            category: complaint?.category || null,
            unassignedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log complaint escalation
 */
async function logEscalation(userId, complaintId, complaint, oldPriority, newPriority, req) {
    return logAudit({
        userId: userId || null,
        userName: req?.user?.name || 'System',
        userRole: req?.user?.role || 'SYSTEM',
        action: 'ESCALATED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        details: {
            category: complaint?.category || null,
            escalatedAt: new Date(),
            reason: 'SLA_EXCEEDED'
        },
        changes: {
            before: { priority: oldPriority },
            after: { priority: newPriority }
        },
        ipAddress: req ? getClientIP(req) : null,
        userAgent: req?.headers?.['user-agent'] || null
    });
}

/**
 * Log comment added
 */
async function logCommentAdded(userId, complaintId, complaint, comment, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'USER',
        action: 'COMMENT_ADDED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        details: {
            commentId: comment._id,
            messageLength: comment.message?.length || 0,
            commentedAt: comment.createdAt
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log comment deleted
 */
async function logCommentDeleted(userId, complaintId, complaintTitle, commentId, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'USER',
        action: 'COMMENT_DELETED',
        complaintId: complaintId,
        complaintTitle: complaintTitle || null,
        details: {
            commentId: commentId,
            deletedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log priority change
 */
async function logPriorityChange(userId, complaintId, complaint, oldPriority, newPriority, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'SUPPORT',
        action: 'PRIORITY_CHANGED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        details: {
            category: complaint?.category || null
        },
        changes: {
            before: { priority: oldPriority },
            after: { priority: newPriority }
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log complaint deletion
 */
async function logComplaintDeleted(userId, complaintId, complaint, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'COMPLAINT_DELETED',
        complaintId: complaintId,
        complaintTitle: complaint?.title || null,
        details: {
            category: complaint?.category || null,
            priority: complaint?.priority || null,
            status: complaint?.status || null,
            deletedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log user creation (SUPPORT user)
 */
async function logSupportUserCreated(userId, newUserId, newUserName, newUserEmail, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'SUPPORT_USER_CREATED',
        targetUserId: newUserId,
        targetUserName: newUserName || null,
        details: {
            email: newUserEmail,
            role: 'SUPPORT',
            createdAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log user blocked
 */
async function logUserBlocked(userId, blockedUserId, blockedUserName, blockedUserEmail, reason, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'USER_BLOCKED',
        targetUserId: blockedUserId,
        targetUserName: blockedUserName || null,
        details: {
            email: blockedUserEmail,
            reason: reason || 'Not specified',
            blockedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Log user unblocked
 */
async function logUserUnblocked(userId, unblockedUserId, unblockedUserName, unblockedUserEmail, req) {
    return logAudit({
        userId: userId,
        userName: req.user?.name || 'Unknown',
        userRole: req.user?.role || 'ADMIN',
        action: 'USER_UNBLOCKED',
        targetUserId: unblockedUserId,
        targetUserName: unblockedUserName || null,
        details: {
            email: unblockedUserEmail,
            unblockedAt: new Date()
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null
    });
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        req.ip ||
        null
    );
}

/**
 * Query audit logs with filters
 */
async function getAuditLogs(filters = {}) {
    try {
        const query = {};

        if (filters.userId) {
            query.userId = filters.userId;
        }
        if (filters.complaintId) {
            query.complaintId = filters.complaintId;
        }
        if (filters.action) {
            query.action = filters.action;
        }
        if (filters.userRole) {
            query.userRole = filters.userRole;
        }
        if (filters.startDate || filters.endDate) {
            query.timestamp = {};
            if (filters.startDate) {
                query.timestamp.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.timestamp.$lte = new Date(filters.endDate);
            }
        }

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 50;
        const skip = (page - 1) * limit;

        const logs = await AuditLog.find(query)
            .populate('userId', 'name email role')
            .populate('complaintId', 'title')
            .populate('targetUserId', 'name email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AuditLog.countDocuments(query);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
    }
}

/**
 * Get audit logs for a specific complaint
 */
async function getComplaintAuditLogs(complaintId, page = 1, limit = 50) {
    try {
        const skip = (page - 1) * limit;

        const logs = await AuditLog.find({ complaintId })
            .populate('userId', 'name email role')
            .populate('targetUserId', 'name email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AuditLog.countDocuments({ complaintId });

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching complaint audit logs:', error);
        throw error;
    }
}

/**
 * Get audit logs for a specific user
 */
async function getUserAuditLogs(userId, page = 1, limit = 50) {
    try {
        const skip = (page - 1) * limit;

        const logs = await AuditLog.find({ userId })
            .populate('complaintId', 'title')
            .populate('targetUserId', 'name email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AuditLog.countDocuments({ userId });

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching user audit logs:', error);
        throw error;
    }
}

/**
 * Get audit logs by action type
 */
async function getAuditLogsByAction(action, page = 1, limit = 50) {
    try {
        const skip = (page - 1) * limit;

        const logs = await AuditLog.find({ action })
            .populate('userId', 'name email role')
            .populate('complaintId', 'title')
            .populate('targetUserId', 'name email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AuditLog.countDocuments({ action });

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching audit logs by action:', error);
        throw error;
    }
}

/**
 * Get audit log statistics
 */
async function getAuditStatistics(startDate, endDate) {
    try {
        const dateQuery = {};
        if (startDate) {
            dateQuery.$gte = new Date(startDate);
        }
        if (endDate) {
            dateQuery.$lte = new Date(endDate);
        }

        const match = dateQuery ? { timestamp: dateQuery } : {};

        const stats = await AuditLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const userStats = await AuditLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const total = await AuditLog.countDocuments(match);

        return {
            total,
            actionStats: stats,
            topUsers: userStats,
            dateRange: {
                startDate: startDate || null,
                endDate: endDate || null
            }
        };
    } catch (error) {
        console.error('Error getting audit statistics:', error);
        throw error;
    }
}

module.exports = {
    logAudit,
    logComplaintCreated,
    logStatusChange,
    logAssignment,
    logReassignment,
    logUnassignment,
    logEscalation,
    logCommentAdded,
    logCommentDeleted,
    logPriorityChange,
    logComplaintDeleted,
    logSupportUserCreated,
    logUserBlocked,
    logUserUnblocked,
    getAuditLogs,
    getComplaintAuditLogs,
    getUserAuditLogs,
    getAuditLogsByAction,
    getAuditStatistics,
    getClientIP
};
