const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        default: null
    },
    userRole: {
        type: String,
        enum: ['USER', 'SUPPORT', 'ADMIN'],
        default: null
    },
    action: {
        type: String,
        enum: [
            'COMPLAINT_CREATED',
            'COMPLAINT_UPDATED',
            'COMPLAINT_DELETED',
            'STATUS_CHANGED',
            'ASSIGNED',
            'REASSIGNED',
            'UNASSIGNED',
            'ESCALATED',
            'COMMENT_ADDED',
            'COMMENT_DELETED',
            'PRIORITY_CHANGED',
            'USER_CREATED',
            'USER_BLOCKED',
            'USER_UNBLOCKED',
            'SUPPORT_USER_CREATED',
            'LOGIN',
            'LOGOUT'
        ],
        required: true
    },
    complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        default: null
    },
    complaintTitle: {
        type: String,
        default: null
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    targetUserName: {
        type: String,
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED'],
        default: 'SUCCESS'
    },
    errorMessage: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ complaintId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
