const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { logEscalation } = require('./auditLogger');

/**
 * SLA Definition: Service Level Agreements based on priority
 * Defines how much time to resolve each complaint level
 */
const SLA_DEFINITIONS = {
    Critical: {
        hours: 2,
        description: 'Must be resolved within 2 hours'
    },
    High: {
        hours: 8,
        description: 'Must be resolved within 8 hours'
    },
    Medium: {
        hours: 24,
        description: 'Must be resolved within 24 hours'
    },
    Low: {
        hours: 48,
        description: 'Must be resolved within 48 hours'
    }
};

/**
 * Calculate SLA deadline based on priority and creation time
 * @param {String} priority - Complaint priority (Critical, High, Medium, Low)
 * @param {Date} createdAt - Complaint creation timestamp
 * @returns {Date} - SLA deadline timestamp
 */
function calculateSLADeadline(priority, createdAt = new Date()) {
    const slaConfig = SLA_DEFINITIONS[priority] || SLA_DEFINITIONS.Medium;
    const deadline = new Date(createdAt);
    deadline.setHours(deadline.getHours() + slaConfig.hours);
    return deadline;
}

/**
 * Check if a complaint has exceeded its SLA deadline
 * @param {Object} complaint - Complaint document
 * @returns {Boolean} - True if SLA deadline has passed and complaint is not resolved
 */
function isOverSLA(complaint) {
    // Don't check SLA for resolved or closed complaints
    if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
        return false;
    }

    // Check if current time is past SLA deadline
    const now = new Date();
    return now > complaint.slaDeadline;
}

/**
 * Get time remaining until SLA deadline
 * @param {Object} complaint - Complaint document
 * @returns {Object} - { hours, minutes, seconds, isOverdue }
 */
function getTimeUntilSLADeadline(complaint) {
    const now = new Date();
    const deadline = new Date(complaint.slaDeadline);
    const diffMs = deadline - now;

    if (diffMs <= 0) {
        return {
            hours: 0,
            minutes: 0,
            seconds: 0,
            isOverdue: true,
            overdueDuration: formatDuration(-diffMs)
        };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return {
        hours,
        minutes,
        seconds,
        isOverdue: false,
        timeRemaining: `${hours}h ${minutes}m ${seconds}s`
    };
}

/**
 * Format duration in milliseconds to readable string
 * @param {Number} ms - Duration in milliseconds
 * @returns {String} - Formatted duration
 */
function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m overdue`;
}

/**
 * Get escalation reason based on complaint status
 * @param {Object} complaint - Complaint document
 * @returns {String} - Reason for escalation
 */
function getEscalationReason(complaint) {
    if (isOverSLA(complaint)) {
        const slaConfig = SLA_DEFINITIONS[complaint.priority];
        const timeInfo = getTimeUntilSLADeadline(complaint);
        return `SLA Exceeded - ${complaint.priority} priority complaint exceeded ${slaConfig.hours}-hour SLA by ${timeInfo.overdueDuration}`;
    }
    return 'Unknown escalation reason';
}

/**
 * Escalate a single complaint
 * @param {String} complaintId - Complaint ID
 * @param {Object} options - { reason, escalatedBy, notes }
 * @returns {Object} - Updated complaint
 */
async function escalateComplaint(complaintId, options = {}) {
    try {
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            throw new Error('Complaint not found');
        }

        // Don't escalate if already resolved/closed or already escalated
        if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
            return null;
        }

        const now = new Date();
        const previousPriority = complaint.priority;

        // Update complaint
        complaint.isEscalated = true;
        complaint.escalatedAt = now;

        // Add to escalation history
        const escalationRecord = {
            escalatedAt: now,
            reason: options.reason || 'SLA_EXCEEDED',
            previousPriority: previousPriority,
            newPriority: previousPriority, // Priority stays same, but gets escalated flag
            escalatedBy: options.escalatedBy || null,
            notes: options.notes || getEscalationReason(complaint)
        };

        complaint.escalationHistory.push(escalationRecord);

        // Escalate priority if not already Critical
        if (complaint.priority !== 'Critical') {
            const priorityHierarchy = { Low: 1, Medium: 2, High: 3, Critical: 4 };
            const currentLevel = priorityHierarchy[complaint.priority];
            const escalatedPriority = Object.keys(priorityHierarchy).find(
                key => priorityHierarchy[key] === Math.min(currentLevel + 1, 4)
            );
            complaint.priority = escalatedPriority;
            escalationRecord.newPriority = escalatedPriority;

            // Recalculate SLA with new priority
            complaint.slaDeadline = calculateSLADeadline(escalatedPriority, complaint.createdAt);
        }

        await complaint.save();

        // Log audit event (if req object is provided)
        if (options.req) {
            try {
                await logEscalation(options.req.userId, complaint._id, complaint, previousPriority, complaint.priority, options.req);
            } catch (auditError) {
                console.error('Error logging escalation audit:', auditError);
                // Don't fail the escalation if audit logging fails
            }
        }

        return complaint;
    } catch (error) {
        console.error('Error escalating complaint:', error);
        throw error;
    }
}

/**
 * Check for all complaints exceeding SLA and escalate them
 * This is the main function called by the scheduler
 * @returns {Object} - { escalatedCount, details }
 */
async function checkAndEscalateDueComplaints() {
    try {
        // Find all non-resolved, non-closed complaints that are over SLA and not already escalated
        const now = new Date();
        const overdueComplaints = await Complaint.find({
            status: { $nin: ['RESOLVED', 'CLOSED'] },
            isEscalated: false,
            slaDeadline: { $lt: now }
        }).populate('assignedTo', 'name email role');

        const escalationResults = [];

        for (const complaint of overdueComplaints) {
            try {
                const escalated = await escalateComplaint(complaint._id, {
                    reason: 'SLA_EXCEEDED',
                    notes: getEscalationReason(complaint)
                });

                if (escalated) {
                    escalationResults.push({
                        complaintId: complaint._id,
                        title: complaint.title,
                        priority: complaint.priority,
                        newPriority: escalated.priority,
                        assignedTo: complaint.assignedTo,
                        slaDeadline: complaint.slaDeadline,
                        overdueBy: formatDuration(now - complaint.slaDeadline)
                    });
                }
            } catch (error) {
                console.error(`Failed to escalate complaint ${complaint._id}:`, error.message);
            }
        }

        return {
            escalatedCount: escalationResults.length,
            details: escalationResults,
            timestamp: now
        };
    } catch (error) {
        console.error('Error checking for SLA violations:', error);
        throw error;
    }
}

/**
 * Get SLA status for a complaint
 * @param {Object} complaint - Complaint document
 * @returns {Object} - { status, timeRemaining, isEscalated, escalationDate }
 */
function getSLAStatus(complaint) {
    const timeInfo = getTimeUntilSLADeadline(complaint);
    const slaConfig = SLA_DEFINITIONS[complaint.priority];

    let statusLabel = 'On Track';
    if (complaint.isEscalated) {
        statusLabel = 'Escalated';
    } else if (timeInfo.isOverdue) {
        statusLabel = 'Overdue';
    } else if (timeInfo.hours === 0) {
        statusLabel = 'Critical - Less than 1 hour';
    }

    return {
        status: statusLabel,
        priority: complaint.priority,
        slaHours: slaConfig.hours,
        slaDeadline: complaint.slaDeadline,
        timeRemaining: timeInfo,
        isEscalated: complaint.isEscalated,
        escalatedAt: complaint.escalatedAt,
        escalationHistory: complaint.escalationHistory,
        createdAt: complaint.createdAt
    };
}

/**
 * Get SLA metrics for dashboard
 * @returns {Object} - SLA statistics
 */
async function getSLAMetrics() {
    try {
        const now = new Date();

        const [totalComplaints, onTrack, atRisk, overdue, escalated] = await Promise.all([
            Complaint.countDocuments({ status: { $nin: ['RESOLVED', 'CLOSED'] } }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $gt: now }
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $gt: now, $lte: new Date(now.getTime() + 1 * 60 * 60 * 1000) } // Within 1 hour
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $lt: now }
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: true
            })
        ]);

        return {
            totalOpenComplaints: totalComplaints,
            onTrack: onTrack,
            atRisk: atRisk,
            overdue: overdue,
            escalated: escalated,
            slaCompliance: totalComplaints > 0 ? ((onTrack / totalComplaints) * 100).toFixed(2) + '%' : '0%'
        };
    } catch (error) {
        console.error('Error getting SLA metrics:', error);
        throw error;
    }
}

/**
 * Update SLA deadline when priority changes
 * @param {Object} complaint - Complaint document
 * @param {String} newPriority - New priority level
 */
function updateSLADeadlineForPriorityChange(complaint, newPriority) {
    const oldDeadline = complaint.slaDeadline;
    complaint.slaDeadline = calculateSLADeadline(newPriority, complaint.createdAt);
    return {
        oldDeadline,
        newDeadline: complaint.slaDeadline,
        priorityChanged: true
    };
}

module.exports = {
    SLA_DEFINITIONS,
    calculateSLADeadline,
    isOverSLA,
    getTimeUntilSLADeadline,
    getEscalationReason,
    escalateComplaint,
    checkAndEscalateDueComplaints,
    getSLAStatus,
    getSLAMetrics,
    updateSLADeadlineForPriorityChange,
    formatDuration
};
