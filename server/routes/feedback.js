const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');
const { auth, authorize } = require('../middleware/auth');

// @route   POST /api/feedback
// @desc    Submit feedback for a CLOSED complaint (USER only)
// @access  Private (USER)
router.post('/', [
    auth,
    authorize('USER'),
    body('complaintId').notEmpty().withMessage('Complaint ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').trim().notEmpty().withMessage('Comment is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { complaintId, rating, comment } = req.body;

        // Check if complaint exists
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Verify the complaint belongs to the user
        if (complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'You can only provide feedback for your own complaints' });
        }

        // CRITICAL BUSINESS RULE: Feedback can only be submitted for CLOSED complaints
        if (complaint.status !== 'CLOSED') {
            return res.status(400).json({
                message: 'Feedback can only be submitted for CLOSED complaints',
                currentStatus: complaint.status
            });
        }

        // Check if feedback already exists for this complaint
        const existingFeedback = await Feedback.findOne({ complaintId });
        if (existingFeedback) {
            return res.status(400).json({ message: 'Feedback already submitted for this complaint' });
        }

        // Create feedback
        const feedback = new Feedback({
            complaintId,
            userId: req.userId,
            rating,
            comment
        });

        await feedback.save();
        await feedback.populate('complaintId', 'title status');
        await feedback.populate('userId', 'name email');

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedback
        });
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ message: 'Server error while submitting feedback' });
    }
});

// @route   GET /api/feedback
// @desc    Get all feedback (SUPPORT sees all, USER sees only their own)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let query = {};

        // If user role is USER, only show their feedback
        if (req.user.role === 'USER') {
            query.userId = req.userId;
        }

        const feedbacks = await Feedback.find(query)
            .populate('complaintId', 'title status category')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        res.json({ feedbacks });
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ message: 'Server error while fetching feedback' });
    }
});

// @route   GET /api/feedback/complaint/:complaintId
// @desc    Get feedback for a specific complaint
// @access  Private
router.get('/complaint/:complaintId', auth, async (req, res) => {
    try {
        const feedback = await Feedback.findOne({ complaintId: req.params.complaintId })
            .populate('complaintId', 'title status category')
            .populate('userId', 'name email');

        if (!feedback) {
            return res.status(404).json({ message: 'No feedback found for this complaint' });
        }

        // Users can only view feedback for their own complaints
        if (req.user.role === 'USER' && feedback.userId._id.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ feedback });
    } catch (error) {
        console.error('Get complaint feedback error:', error);
        res.status(500).json({ message: 'Server error while fetching feedback' });
    }
});

module.exports = router;
