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

// ─────────────────────────────────────────────────────────────────
// NEW ANALYTICS ENDPOINTS - ENHANCED METRICS
// ─────────────────────────────────────────────────────────────────

// @route   GET /api/analytics/avg-resolution-time
// @desc    Get average resolution time in hours
// @access  Private (SUPPORT)
router.get('/avg-resolution-time', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        // Get all resolved and closed complaints with createdAt and closedAt
        const resolvedComplaints = await Complaint.find({
            status: { $in: ['RESOLVED', 'CLOSED'] },
            closedAt: { $exists: true }
        }).select('createdAt closedAt priority');

        if (resolvedComplaints.length === 0) {
            return res.json({
                avgResolutionTimeHours: 0,
                avgResolutionTimeMinutes: 0,
                totalResolved: 0,
                breakdown: {
                    byPriority: {},
                    min: 0,
                    max: 0
                }
            });
        }

        // Calculate resolution times
        const resolutionTimes = resolvedComplaints.map(complaint => ({
            hours: (complaint.closedAt - complaint.createdAt) / (1000 * 60 * 60),
            priority: complaint.priority
        }));

        // Calculate averages
        const totalHours = resolutionTimes.reduce((sum, rt) => sum + rt.hours, 0);
        const avgHours = totalHours / resolvedComplaints.length;
        const avgMinutes = (avgHours % 1) * 60;

        // Breakdown by priority
        const byPriority = {};
        ['Critical', 'High', 'Medium', 'Low'].forEach(priority => {
            const filtered = resolutionTimes.filter(rt => rt.priority === priority);
            if (filtered.length > 0) {
                const avgPriorityHours = filtered.reduce((sum, rt) => sum + rt.hours, 0) / filtered.length;
                byPriority[priority] = {
                    avg: Math.round(avgPriorityHours * 100) / 100,
                    count: filtered.length
                };
            }
        });

        const minTime = Math.min(...resolutionTimes.map(rt => rt.hours));
        const maxTime = Math.max(...resolutionTimes.map(rt => rt.hours));

        res.json({
            avgResolutionTimeHours: Math.round(avgHours * 100) / 100,
            avgResolutionTimeMinutes: Math.round(avgMinutes),
            totalResolved: resolvedComplaints.length,
            breakdown: {
                byPriority,
                min: Math.round(minTime * 100) / 100,
                max: Math.round(maxTime * 100) / 100
            }
        });
    } catch (error) {
        console.error('Avg resolution time error:', error);
        res.status(500).json({ message: 'Server error calculating resolution time' });
    }
});

// @route   GET /api/analytics/support-staff-performance
// @desc    Get complaints per support staff member
// @access  Private (SUPPORT)
router.get('/support-staff-performance', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        // Get assigned complaints grouped by support staff
        const staffData = await Complaint.aggregate([
            { $match: { assignedTo: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$assignedTo',
                    totalAssigned: { $sum: 1 },
                    resolved: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0]
                        }
                    },
                    closed: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0]
                        }
                    },
                    inProgress: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0]
                        }
                    },
                    assigned: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'ASSIGNED'] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { totalAssigned: -1 } }
        ]);

        // Populate user details
        const staffWithDetails = await Promise.all(
            staffData.map(async (staff) => {
                const user = await User.findById(staff._id).select('name email role');
                const resolutionRate = staff.totalAssigned > 0
                    ? Math.round(((staff.resolved + staff.closed) / staff.totalAssigned) * 100)
                    : 0;

                return {
                    staffId: staff._id,
                    name: user?.name || 'Unknown',
                    email: user?.email || '',
                    totalAssigned: staff.totalAssigned,
                    resolved: staff.resolved,
                    closed: staff.closed,
                    inProgress: staff.inProgress,
                    assigned: staff.assigned,
                    resolutionRate: resolutionRate,
                    pending: staff.inProgress + staff.assigned
                };
            })
        );

        res.json({
            staffPerformance: staffWithDetails,
            totalStaffMembers: staffWithDetails.length
        });
    } catch (error) {
        console.error('Support staff performance error:', error);
        res.status(500).json({ message: 'Server error fetching staff performance' });
    }
});

// @route   GET /api/analytics/sla-breach-rate
// @desc    Get SLA breach percentage and details
// @access  Private (SUPPORT)
router.get('/sla-breach-rate', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        // Get all resolved/closed complaints
        const resolvedComplaints = await Complaint.find({
            status: { $in: ['RESOLVED', 'CLOSED'] }
        }).select('slaDeadline closedAt isEscalated priority');

        if (resolvedComplaints.length === 0) {
            return res.json({
                totalComplaints: 0,
                breachedCount: 0,
                breachPercentage: 0,
                breakdown: {
                    byPriority: {},
                    byEscalation: { escalated: 0, notEscalated: 0 }
                }
            });
        }

        // Calculate breaches
        let breachedCount = 0;
        const breachByPriority = {};
        let escalatedBreaches = 0;
        let notEscalatedBreaches = 0;

        resolvedComplaints.forEach(complaint => {
            const isBreach = complaint.closedAt > complaint.slaDeadline;

            if (isBreach) {
                breachedCount++;
                breachByPriority[complaint.priority] = (breachByPriority[complaint.priority] || 0) + 1;

                if (complaint.isEscalated) {
                    escalatedBreaches++;
                } else {
                    notEscalatedBreaches++;
                }
            }
        });

        const breachPercentage = (breachedCount / resolvedComplaints.length) * 100;

        // Convert counts to percentages for each priority
        const priorityBreachPercentage = {};
        ['Critical', 'High', 'Medium', 'Low'].forEach(priority => {
            const priorityComplaints = resolvedComplaints.filter(c => c.priority === priority);
            if (priorityComplaints.length > 0) {
                const priorityBreaches = breachByPriority[priority] || 0;
                priorityBreachPercentage[priority] = {
                    count: priorityBreaches,
                    total: priorityComplaints.length,
                    percentage: Math.round((priorityBreaches / priorityComplaints.length) * 100 * 100) / 100
                };
            }
        });

        res.json({
            totalComplaints: resolvedComplaints.length,
            breachedCount,
            breachPercentage: Math.round(breachPercentage * 100) / 100,
            breakdown: {
                byPriority: priorityBreachPercentage,
                byEscalation: {
                    escalated: escalatedBreaches,
                    notEscalated: notEscalatedBreaches
                }
            },
            slaMet: resolvedComplaints.length - breachedCount,
            slaMetPercentage: Math.round(((resolvedComplaints.length - breachedCount) / resolvedComplaints.length) * 100 * 100) / 100
        });
    } catch (error) {
        console.error('SLA breach rate error:', error);
        res.status(500).json({ message: 'Server error calculating SLA breach rate' });
    }
});

// @route   GET /api/analytics/category-trends
// @desc    Get complaint trends by category over time (last 30 days)
// @access  Private (SUPPORT)
router.get('/category-trends', [auth, authorize('SUPPORT')], async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate complaints by category and date
        const data = await Complaint.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: {
                        category: '$category',
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Transform data into time-series format
        const timeSeriesData = {};
        const dateSet = new Set();

        data.forEach(d => {
            const date = `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`;
            dateSet.add(date);

            if (!timeSeriesData[d._id.category]) {
                timeSeriesData[d._id.category] = {};
            }
            timeSeriesData[d._id.category][date] = d.count;
        });

        // Convert to sorted date array and fill in missing dates with 0
        const sortedDates = Array.from(dateSet).sort();

        const categoryTrends = Object.keys(timeSeriesData).map(category => ({
            category,
            data: sortedDates.map(date => timeSeriesData[category][date] || 0)
        }));

        res.json({
            categoryTrends,
            dates: sortedDates,
            categories: Object.keys(timeSeriesData)
        });
    } catch (error) {
        console.error('Category trends error:', error);
        res.status(500).json({ message: 'Server error fetching category trends' });
    }
});

module.exports = router;
