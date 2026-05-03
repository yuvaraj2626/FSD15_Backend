const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const {
    getAuditLogs,
    getComplaintAuditLogs,
    getUserAuditLogs,
    getAuditLogsByAction,
    getAuditStatistics
} = require('../utils/auditLogger');

/**
 * @route   GET /api/audit
 * @desc    Get all audit logs with optional filters (ADMIN only)
 * @access  Private (ADMIN)
 * @query   page=1 - Page number
 * @query   limit=50 - Results per page
 * @query   userId - Filter by user
 * @query   complaintId - Filter by complaint
 * @query   action - Filter by action type
 * @query   userRole - Filter by user role
 * @query   startDate - Filter by start date (ISO string)
 * @query   endDate - Filter by end date (ISO string)
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const filters = {
            userId: req.query.userId || null,
            complaintId: req.query.complaintId || null,
            action: req.query.action || null,
            userRole: req.query.userRole || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            page: req.query.page || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 500) // Max 500 per page
        };

        const result = await getAuditLogs(filters);

        res.json({
            message: 'Audit logs retrieved successfully',
            ...result
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Server error while fetching audit logs' });
    }
});

/**
 * @route   GET /api/audit/complaint/:complaintId
 * @desc    Get audit logs for a specific complaint
 * @access  Private (ADMIN)
 * @query   page=1 - Page number
 * @query   limit=50 - Results per page
 */
router.get('/complaint/:complaintId', verifyToken, isAdmin, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);

        const result = await getComplaintAuditLogs(req.params.complaintId, page, limit);

        res.json({
            message: 'Complaint audit logs retrieved successfully',
            complaintId: req.params.complaintId,
            ...result
        });
    } catch (error) {
        console.error('Error fetching complaint audit logs:', error);
        res.status(500).json({ message: 'Server error while fetching complaint audit logs' });
    }
});

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get audit logs for a specific user
 * @access  Private (ADMIN)
 * @query   page=1 - Page number
 * @query   limit=50 - Results per page
 */
router.get('/user/:userId', verifyToken, isAdmin, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);

        const result = await getUserAuditLogs(req.params.userId, page, limit);

        res.json({
            message: 'User audit logs retrieved successfully',
            userId: req.params.userId,
            ...result
        });
    } catch (error) {
        console.error('Error fetching user audit logs:', error);
        res.status(500).json({ message: 'Server error while fetching user audit logs' });
    }
});

/**
 * @route   GET /api/audit/action/:action
 * @desc    Get audit logs by action type
 * @access  Private (ADMIN)
 * @query   page=1 - Page number
 * @query   limit=50 - Results per page
 */
router.get('/action/:action', verifyToken, isAdmin, async (req, res) => {
    try {
        const validActions = [
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
        ];

        if (!validActions.includes(req.params.action)) {
            return res.status(400).json({ message: 'Invalid action type' });
        }

        const page = req.query.page || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);

        const result = await getAuditLogsByAction(req.params.action, page, limit);

        res.json({
            message: 'Audit logs retrieved successfully',
            action: req.params.action,
            ...result
        });
    } catch (error) {
        console.error('Error fetching audit logs by action:', error);
        res.status(500).json({ message: 'Server error while fetching audit logs' });
    }
});

/**
 * @route   GET /api/audit/statistics
 * @desc    Get audit log statistics (ADMIN only)
 * @access  Private (ADMIN)
 * @query   startDate - Filter by start date (ISO string)
 * @query   endDate - Filter by end date (ISO string)
 */
router.get('/statistics', verifyToken, isAdmin, async (req, res) => {
    try {
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;

        const stats = await getAuditStatistics(startDate, endDate);

        res.json({
            message: 'Audit statistics retrieved successfully',
            ...stats
        });
    } catch (error) {
        console.error('Error fetching audit statistics:', error);
        res.status(500).json({ message: 'Server error while fetching audit statistics' });
    }
});

module.exports = router;
