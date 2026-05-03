const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { verifyToken, isAdmin } = require('../middleware/auth');
const {
    createSupportUser,
    getAllUsers,
    blockUser,
    unblockUser,
    getAdminStats
} = require('../controllers/adminController');
const {
    logSupportUserCreated,
    logUserBlocked,
    logUserUnblocked
} = require('../utils/auditLogger');

/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │                   ADMIN ROUTES - RBAC PROTECTED              │
 * │              All routes require: verifyToken + isAdmin       │
 * └─────────────────────────────────────────────────────────────┘
 */

// @route   POST /api/admin/create-support
// @desc    Create a new SUPPORT user
// @access  Private (ADMIN ONLY)
router.post('/create-support', [
    verifyToken,
    isAdmin,
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], createSupportUser);

// @route   GET /api/admin/users
// @desc    Get all users with filtering and pagination
// @access  Private (ADMIN ONLY)
// Query params:
//   - page: page number (default: 1)
//   - limit: items per page (default: 10)
//   - role: filter by role (USER, SUPPORT, ADMIN)
//   - blocked: filter by blocked status (true/false)
//   - search: search by name or email
router.get('/users', [verifyToken, isAdmin], getAllUsers);

// @route   PUT /api/admin/block-user/:id
// @desc    Block a user (prevent login)
// @access  Private (ADMIN ONLY)
router.put('/block-user/:id', [
    verifyToken,
    isAdmin,
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason must be less than 500 characters')
], blockUser);

// @route   PUT /api/admin/unblock-user/:id
// @desc    Unblock a user (allow login)
// @access  Private (ADMIN ONLY)
router.put('/unblock-user/:id', [verifyToken, isAdmin], unblockUser);

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (ADMIN ONLY)
router.get('/stats', [verifyToken, isAdmin], getAdminStats);

module.exports = router;
