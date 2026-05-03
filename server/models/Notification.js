const mongoose = require('mongoose');

/**
 * Notification Model
 * Stores in-app and email escalation notifications for audit and display.
 */
const notificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        required: true
    },
    type: {
        type: String,
        enum: [
            'ESCALATION',
            'ASSIGNMENT',
            'SLA_WARNING',
            'SLA_BREACH',
            'STATUS_CHANGE',
            'COMMENT',
            'GENERAL'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: {
        type: Date,
        default: null
    },
    metadata: {
        escalationLevel: Number,
        previousAssignee: String,
        newAssignee: String,
        previousPriority: String,
        newPriority: String,
        slaDeadline: Date,
        overdueBy: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Index for fetching unread notifications efficiently
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
