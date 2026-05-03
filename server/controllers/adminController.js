const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { logSupportUserCreated, logUserBlocked, logUserUnblocked } = require('../utils/auditLogger');

/**
 * Create a new SUPPORT user
 * POST /api/admin/create-support
 * ADMIN ONLY
 */
const createSupportUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new SUPPORT user
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'SUPPORT',
            blocked: false
        });

        await user.save();

        // Log audit event
        await logSupportUserCreated(req.userId, user, req);

        res.status(201).json({
            message: 'Support user created successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                blocked: user.blocked,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating support user:', error);
        res.status(500).json({ message: 'Server error creating support user' });
    }
};

/**
 * Get all users with pagination and filtering
 * GET /api/admin/users
 * ADMIN ONLY
 */
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, blocked, search } = req.query;
        const skip = (page - 1) * limit;

        // Build filter object
        let filter = {};

        if (role && ['USER', 'SUPPORT', 'ADMIN'].includes(role)) {
            filter.role = role;
        }

        if (blocked !== undefined) {
            filter.blocked = blocked === 'true';
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const total = await User.countDocuments(filter);

        // Get users
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip(skip)
            .exec();

        res.json({
            message: 'Users retrieved successfully',
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
};

/**
 * Block a user
 * PUT /api/admin/block-user/:id
 * ADMIN ONLY
 */
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Validate user ID
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent blocking admin
        if (user.role === 'ADMIN') {
            return res.status(403).json({ message: 'Cannot block an admin user' });
        }

        // Check if already blocked
        if (user.blocked) {
            return res.status(400).json({ message: 'User is already blocked' });
        }

        // Block user
        user.blocked = true;
        user.blockedReason = reason || 'No reason provided';
        user.updatedAt = new Date();
        await user.save();

        // Log audit event
        await logUserBlocked(req.userId, user._id, user, req.body.reason || 'No reason provided', req);

        res.json({
            message: 'User blocked successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                blocked: user.blocked,
                blockedReason: user.blockedReason,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ message: 'Server error blocking user' });
    }
};

/**
 * Unblock a user
 * PUT /api/admin/unblock-user/:id
 * ADMIN ONLY
 */
const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate user ID
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already unblocked
        if (!user.blocked) {
            return res.status(400).json({ message: 'User is not blocked' });
        }

        // Unblock user
        user.blocked = false;
        user.blockedReason = null;
        user.updatedAt = new Date();
        await user.save();

        // Log audit event
        await logUserUnblocked(req.userId, user._id, user, req);

        res.json({
            message: 'User unblocked successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                blocked: user.blocked,
                blockedReason: user.blockedReason,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ message: 'Server error unblocking user' });
    }
};

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 * ADMIN ONLY
 */
const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalAdmins = await User.countDocuments({ role: 'ADMIN' });
        const totalSupport = await User.countDocuments({ role: 'SUPPORT' });
        const totalCustomers = await User.countDocuments({ role: 'USER' });
        const blockedUsers = await User.countDocuments({ blocked: true });

        res.json({
            message: 'Admin stats retrieved successfully',
            stats: {
                totalUsers,
                totalAdmins,
                totalSupport,
                totalCustomers,
                blockedUsers,
                activeUsers: totalUsers - blockedUsers
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ message: 'Server error fetching admin stats' });
    }
};

module.exports = {
    createSupportUser,
    getAllUsers,
    blockUser,
    unblockUser,
    getAdminStats
};
