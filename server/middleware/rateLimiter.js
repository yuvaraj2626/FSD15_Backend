/**
 * Rate Limiting Middleware
 * 
 * Protects against brute-force login, registration spam, and API abuse.
 * Uses express-rate-limit with different tiers for different endpoints.
 */

const rateLimit = require('express-rate-limit');

// ── Auth rate limiter (strict) ────────────────────────────────
// Prevents brute-force login / registration spam
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20,                    // max 20 requests per window
    message: {
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false        // Disable `X-RateLimit-*` headers
});

// ── General API rate limiter (moderate) ───────────────────────
// Prevents general API abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 200,                   // max 200 requests per window
    message: {
        message: 'Too many requests from this IP. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Complaint creation limiter ────────────────────────────────
// Prevents complaint-spam from a single IP
const complaintLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 30,                    // max 30 new complaints per hour
    message: {
        message: 'Complaint creation limit reached. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    authLimiter,
    apiLimiter,
    complaintLimiter
};
