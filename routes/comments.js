const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Complaint = require('../models/Complaint');
const { auth } = require('../middleware/auth');

// @route   GET /api/comments/:complaintId
// @desc    Get ALL comments for a complaint (activity timeline — all types)
// @access  Private
router.get('/:complaintId', auth, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only view comments on their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const comments = await Comment.find({ complaintId: req.params.complaintId })
            .populate('userId', 'name email role')
            .populate('senderId', 'name email role')
            .sort({ createdAt: 1 });

        res.json({ comments });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ message: 'Server error while fetching comments' });
    }
});

// @route   POST /api/comments/:complaintId
// @desc    Add a comment (used by ActivityTimeline; supports text field)
// @access  Private
router.post('/:complaintId', [
    auth,
    body('text').trim().notEmpty().withMessage('Comment text is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        // Users can only comment on their own complaints
        if (req.user.role === 'USER' && complaint.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const comment = new Comment({
            complaintId: req.params.complaintId,
            senderId: req.userId,
            userId: req.userId,
            senderRole: req.user.role,
            message: req.body.text,
            text: req.body.text,
            type: 'comment'
        });

        await comment.save();
        await comment.populate('userId', 'name email role');
        await comment.populate('senderId', 'name email role');

        res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error while adding comment' });
    }
});

module.exports = router;
