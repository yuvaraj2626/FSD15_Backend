const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Keep userId as alias for backward compatibility (activity timeline uses this)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    senderRole: {
        type: String,
        enum: ['USER', 'SUPPORT', 'ADMIN'],
        required: true
    },
    message: {
        type: String,
        trim: true
    },
    // Keep text as alias for backward compatibility (system/status_change comments use this)
    text: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['comment', 'status_change', 'system'],
        default: 'comment'
    },
    oldStatus: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', null],
        default: null
    },
    newStatus: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', null],
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
