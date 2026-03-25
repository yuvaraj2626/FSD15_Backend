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
        enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        default: 'OPEN'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
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
    }
});

// Update the updatedAt timestamp before saving
complaintSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.status === 'CLOSED' && !this.closedAt) {
        this.closedAt = Date.now();
    }
    next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
