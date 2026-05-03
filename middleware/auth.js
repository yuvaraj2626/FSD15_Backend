const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token
 * Attaches user object to req.user
 */
const verifyToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

/**
 * Middleware to check if user is ADMIN
 * Must be used after verifyToken
 */
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            message: 'Access denied. Admin privileges required.'
        });
    }

    next();
};

/**
 * Middleware to check if user is ADMIN or SUPPORT
 * Must be used after verifyToken
 */
const isSupport = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!['ADMIN', 'SUPPORT'].includes(req.user.role)) {
        return res.status(403).json({
            message: 'Access denied. Support or Admin privileges required.'
        });
    }

    next();
};

/**
 * Middleware to check if user is a specific role
 * Flexible authorization for multiple roles
 * Usage: authorize(['USER', 'ADMIN'])(req, res, next)
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
};

// Backward compatibility - auth now maps to verifyToken
const auth = verifyToken;

module.exports = { 
    verifyToken,
    isAdmin,
    isSupport,
    authorize,
    auth // backward compatibility
};
