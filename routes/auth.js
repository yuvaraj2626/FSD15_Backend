const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ── Token helpers ─────────────────────────────────────────────

/**
 * Generate a short-lived access token (15 minutes).
 */
function generateAccessToken(user) {
    return jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
}

/**
 * Generate a long-lived refresh token (7 days).
 */
function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
        { expiresIn: '7d' }
    );
}

// @route   POST /api/auth/register
// @desc    Register a new user (always creates USER role)
// @access  Public
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
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

        // Create new user with USER role (always)
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'USER'
        });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store hashed refresh token in DB
        user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await user.save();

        res.status(201).json({
            message: 'User registered successfully',
            token: accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if user is blocked
        if (user.blocked) {
            return res.status(403).json({
                message: 'Your account has been blocked',
                reason: user.blockedReason || 'No reason provided'
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store hashed refresh token in DB
        user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await user.save();

        res.json({
            message: 'Login successful',
            token: accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// @route   POST /api/auth/refresh
// @desc    Get new access token using refresh token
// @access  Public (requires valid refresh token)
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token is required' });
        }

        // Verify the refresh token signature
        let decoded;
        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
            );
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        if (decoded.type !== 'refresh') {
            return res.status(401).json({ message: 'Invalid token type' });
        }

        // Find user and verify stored hash matches
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        if (user.refreshToken !== hashedToken) {
            // Possible token reuse attack — invalidate all tokens
            user.refreshToken = null;
            await user.save();
            return res.status(401).json({ message: 'Refresh token has been revoked' });
        }

        // Rotate: issue new pair
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
        await user.save();

        res.json({
            token: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Server error during token refresh' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout — invalidate refresh token
// @access  Private
router.post('/logout', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user) {
            user.refreshToken = null;
            await user.save();
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout' });
    }
});

// @route   POST /api/auth/create-support-user
// @desc    Create a SUPPORT user (ADMIN only)
// @access  Private (ADMIN)
router.post('/create-support-user', [
    verifyToken,
    isAdmin,
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
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
            role: 'SUPPORT'
        });

        await user.save();

        res.status(201).json({
            message: 'Support user created successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error creating support user:', error);
        res.status(500).json({ message: 'Server error creating support user' });
    }
});

module.exports = router;
