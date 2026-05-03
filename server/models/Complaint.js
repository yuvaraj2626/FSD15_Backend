const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Technical', 'Billing', 'Service', 'Product', 'Other']
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        default: 'OPEN'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedAt: {
        type: Date,
        default: null
    },

    // ── SLA Fields ──────────────────────────────────────────────
    slaDuration: {
        type: Number,      // SLA duration in minutes
        required: true
    },
    slaDeadline: {
        type: Date,
        required: true
    },

    // ── Escalation Fields ────────────────────────────────────────
    isEscalated: {
        type: Boolean,
        default: false
    },
    escalated: {
        type: Boolean,
        default: false
    },
    escalatedAt: {
        type: Date,
        default: null
    },
    escalationLevel: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    escalationCount: {
        type: Number,
        default: 0
    },
    escalationHistory: [{
        escalatedAt: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            enum: ['SLA_EXCEEDED', 'MANUAL'],
            default: 'SLA_EXCEEDED'
        },
        previousPriority: String,
        newPriority: String,
        previousAssignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        newAssignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        escalationLevel: Number,
        escalatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    }],

    // ── Timestamps ────────────────────────────────────────────
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date
    },
    attachmentUrl: {
        type: String,
        default: null
    },
    completionProofUrl: {
        type: String,
        default: null
    },
    completionProofUploadedAt: {
        type: Date,
        default: null
    },
    completionProofUploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
});

// ── Indexes for efficient SLA queries ─────────────────────────
complaintSchema.index({ status: 1, slaDeadline: 1, isEscalated: 1 });
complaintSchema.index({ status: 1, escalationLevel: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });

// Update the updatedAt timestamp before saving
complaintSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.status === 'CLOSED' && !this.closedAt) {
        this.closedAt = Date.now();
    }
    // Keep escalated in sync with isEscalated
    this.escalated = this.isEscalated;
    next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
