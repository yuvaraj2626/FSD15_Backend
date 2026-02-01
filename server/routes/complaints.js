const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const { auth, authorize } = require('../middleware/auth');

// @route   POST /api/complaints
// @desc    Create a new complaint (USER only)
// @access  Private (USER)
router.post('/', [
    auth,
    authorize('USER'),
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

        const complaint = new Complaint({
            userId: req.userId,
            title,
            description,
            category,
            priority: priority || 'Medium'
        });

        await complaint.save();
        await complaint.populate('userId', 'name email');

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
// @desc    Get all complaints (SUPPORT sees all, USER sees only their own)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let query = {};

        // If user role is USER, only show their complaints
        if (req.user.role === 'USER') {
            query.userId = req.userId;
        }

        const complaints = await Complaint.find(query)
            .populate('userId', 'name email')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        res.json({ complaints });
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

        res.json({ message: 'Complaint deleted successfully' });
    } catch (error) {
        console.error('Delete complaint error:', error);
        res.status(500).json({ message: 'Server error while deleting complaint' });
    }
});

module.exports = router;
