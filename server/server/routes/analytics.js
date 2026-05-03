const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

// @route   GET /api/analytics/overview
// @desc    Get analytics overview (SUPPORT only)
// @access  Private (SUPPORT)
router.get('/overview', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const totalComplaints = await Complaint.countDocuments();
        const openComplaints = await Complaint.countDocuments({ status: 'OPEN' });
        const inProgressComplaints = await Complaint.countDocuments({ status: 'IN_PROGRESS' });
        const resolvedComplaints = await Complaint.countDocuments({ status: 'RESOLVED' });
        const closedComplaints = await Complaint.countDocuments({ status: 'CLOSED' });
        const totalUsers = await User.countDocuments({ role: 'USER' });
        const totalFeedbacks = await Feedback.countDocuments();

        // Average rating
        const feedbacks = await Feedback.find();
        const avgRating = feedbacks.length
            ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)
            : 0;

        // Resolution rate
        const resolutionRate = totalComplaints > 0
            ? (((resolvedComplaints + closedComplaints) / totalComplaints) * 100).toFixed(1)
            : 0;

        res.json({
            overview: {
                totalComplaints,
                openComplaints,
                inProgressComplaints,
                resolvedComplaints,
                closedComplaints,
                totalUsers,
                totalFeedbacks,
                avgRating: parseFloat(avgRating),
                resolutionRate: parseFloat(resolutionRate)
            }
        });
    } catch (error) {
        console.error('Analytics overview error:', error);
        res.status(500).json({ message: 'Server error while fetching analytics' });
    }
});

// @route   GET /api/analytics/by-category
// @desc    Get complaints grouped by category
// @access  Private (SUPPORT)
router.get('/by-category', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const data = await Complaint.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json({ byCategory: data });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/by-status
// @desc    Get complaints grouped by status
// @access  Private (SUPPORT)
router.get('/by-status', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const data = await Complaint.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        res.json({ byStatus: data });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/by-priority
// @desc    Get complaints grouped by priority
// @access  Private (SUPPORT)
router.get('/by-priority', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const data = await Complaint.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json({ byPriority: data });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/trend
// @desc    Get complaints created per day for the last 30 days
// @access  Private (SUPPORT)
router.get('/trend', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const data = await Complaint.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        const trend = data.map(d => ({
            date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
            count: d.count
        }));

        res.json({ trend });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/ratings
// @desc    Get rating distribution
// @access  Private (SUPPORT)
router.get('/ratings', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const data = await Feedback.aggregate([
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ ratings: data });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
