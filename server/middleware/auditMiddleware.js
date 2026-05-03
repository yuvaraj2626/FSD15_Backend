/**
 * Audit Logging Middleware
 * Automatically captures request/response data for audit logging
 */

/**
 * Middleware to capture request metadata for audit logging
 */
function captureAuditContext(req, res, next) {
    // Store audit context in request object
    req.auditContext = {
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
        method: req.method,
        path: req.path,
        timestamp: new Date()
    };

    next();
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        req.ip ||
        null
    );
}

module.exports = {
    captureAuditContext
};
