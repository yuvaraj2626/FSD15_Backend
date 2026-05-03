const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { logEscalation } = require('./auditLogger');
const { sendEscalationEmail } = require('./emailService');

/**
 * ═══════════════════════════════════════════════════════════════
 * SLA DEFINITIONS — Production-grade Service Level Agreements
 * ═══════════════════════════════════════════════════════════════
 *
 * Priority → SLA time mapping (in minutes for precision):
 *   Low      → 48 hours  (2880 min)
 *   Medium   → 24 hours  (1440 min)
 *   High     → 6 hours   (360 min)
 *   Critical → 2 hours   (120 min)
 */
const SLA_DEFINITIONS = {
    Critical: {
        hours: 2,
        minutes: 120,
        description: 'Must be resolved within 2 hours'
    },
    High: {
        hours: 6,
        minutes: 360,
        description: 'Must be resolved within 6 hours'
    },
    Medium: {
        hours: 24,
        minutes: 1440,
        description: 'Must be resolved within 24 hours'
    },
    Low: {
        hours: 48,
        minutes: 2880,
        description: 'Must be resolved within 48 hours'
    }
};

/**
 * Maximum escalation level. Beyond this, no further auto-escalation.
 * Level 0 → Original assignment
 * Level 1 → Escalated to senior support
 * Level 2 → Escalated to Admin
 * Level 3 → Critical — admin notified again (final)
 */
const MAX_ESCALATION_LEVEL = 3;

/**
 * SLA extension per escalation (in minutes).
 * Each escalation adds a bit of extra time to allow the new assignee to act.
 */
const ESCALATION_SLA_EXTENSION_MINUTES = 60; // 1 hour grace period per escalation

// ═══════════════════════════════════════════════════════════════
// CORE SLA FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate SLA deadline based on priority and creation time.
 * @param {String} priority - Complaint priority (Critical, High, Medium, Low)
 * @param {Date} createdAt - Complaint creation timestamp
 * @returns {Date} - SLA deadline timestamp
 */
function calculateSLADeadline(priority, createdAt = new Date()) {
    const slaConfig = SLA_DEFINITIONS[priority] || SLA_DEFINITIONS.Medium;
    const deadline = new Date(createdAt);
    deadline.setMinutes(deadline.getMinutes() + slaConfig.minutes);
    return deadline;
}

/**
 * Get SLA duration in minutes for a given priority.
 * @param {String} priority
 * @returns {Number} minutes
 */
function getSLADurationMinutes(priority) {
    const slaConfig = SLA_DEFINITIONS[priority] || SLA_DEFINITIONS.Medium;
    return slaConfig.minutes;
}

/**
 * Check if a complaint has exceeded its SLA deadline.
 * @param {Object} complaint - Complaint document
 * @returns {Boolean} - True if SLA deadline has passed and complaint is not resolved
 */
function isOverSLA(complaint) {
    if (['RESOLVED', 'CLOSED'].includes(complaint.status)) {
        return false;
    }
    const now = new Date();
    return now > complaint.slaDeadline;
}

/**
 * Get time remaining until SLA deadline.
 * @param {Object} complaint - Complaint document
 * @returns {Object} - { hours, minutes, seconds, totalMs, isOverdue, timeRemaining, overdueDuration, percentage }
 */
function getTimeUntilSLADeadline(complaint) {
    const now = new Date();
    const deadline = new Date(complaint.slaDeadline);
    const diffMs = deadline - now;

    // Calculate SLA total duration for percentage
    const slaConfig = SLA_DEFINITIONS[complaint.priority] || SLA_DEFINITIONS.Medium;
    const totalSlaDuration = slaConfig.minutes * 60 * 1000; // in ms
    const elapsed = now - new Date(complaint.createdAt);
    const percentage = Math.min(100, Math.max(0, (elapsed / totalSlaDuration) * 100));

    if (diffMs <= 0) {
        return {
            hours: 0,
            minutes: 0,
            seconds: 0,
            totalMs: diffMs,
            isOverdue: true,
            overdueDuration: formatDuration(-diffMs),
            percentage: 100,
            urgency: 'breached'
        };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Determine urgency level
    let urgency = 'on_track';
    if (percentage >= 90) urgency = 'critical';
    else if (percentage >= 75) urgency = 'warning';
    else if (percentage >= 50) urgency = 'caution';

    return {
        hours,
        minutes,
        seconds,
        totalMs: diffMs,
        isOverdue: false,
        timeRemaining: `${hours}h ${minutes}m ${seconds}s`,
        percentage: Math.round(percentage * 100) / 100,
        urgency
    };
}

/**
 * Format duration in milliseconds to readable string.
 */
function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m overdue`;
}

// ═══════════════════════════════════════════════════════════════
// SMART REASSIGNMENT LOGIC
// ═══════════════════════════════════════════════════════════════

/**
 * Find the best available agent for reassignment based on escalation level.
 *
 * Escalation Level 1 → Find SUPPORT user with least workload (senior support)
 * Escalation Level 2+ → Find ADMIN user, fallback to least-loaded SUPPORT
 *
 * @param {Number} escalationLevel - Current escalation level
 * @param {String|null} currentAssigneeId - ID of currently assigned user (to exclude)
 * @returns {Object|null} - Best available user or null
 */
async function findBestAgentForEscalation(escalationLevel, currentAssigneeId = null) {
    try {
        let targetRole = 'SUPPORT';

        // Level 2+ → try Admin first
        if (escalationLevel >= 2) {
            const admin = await findLeastLoadedUserByRole('ADMIN', currentAssigneeId);
            if (admin) return admin;
            // Fallback to support if no admin available
        }

        return await findLeastLoadedUserByRole(targetRole, currentAssigneeId);
    } catch (error) {
        console.error('[SLA] Error finding escalation agent:', error.message);
        return null;
    }
}

/**
 * Find the user with the least active workload for a given role.
 * @param {String} role - 'SUPPORT' or 'ADMIN'
 * @param {String|null} excludeUserId - User to exclude
 * @returns {Object|null}
 */
async function findLeastLoadedUserByRole(role, excludeUserId = null) {
    const query = { role, blocked: { $ne: true } };
    if (excludeUserId) {
        query._id = { $ne: excludeUserId };
    }

    const users = await User.find(query).select('_id name email role').lean();
    if (users.length === 0) return null;

    // Count active complaints per user
    const workload = await Complaint.aggregate([
        {
            $match: {
                assignedTo: { $in: users.map(u => u._id) },
                status: { $nin: ['RESOLVED', 'CLOSED'] }
            }
        },
        {
            $group: {
                _id: '$assignedTo',
                activeCount: { $sum: 1 }
            }
        }
    ]);

    const workloadMap = new Map();
    workload.forEach(w => workloadMap.set(w._id.toString(), w.activeCount));

    let bestUser = null;
    let minWorkload = Infinity;

    for (const user of users) {
        const count = workloadMap.get(user._id.toString()) || 0;
        if (count < minWorkload) {
            minWorkload = count;
            bestUser = user;
        }
    }

    return bestUser;
}

// ═══════════════════════════════════════════════════════════════
// ESCALATION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Escalate a single complaint.
 *
 * Actions:
 *   1. Bump escalationLevel
 *   2. Set isEscalated = true
 *   3. Optionally bump priority
 *   4. Reassign to appropriate agent (smart reassignment)
 *   5. Extend SLA deadline
 *   6. Save escalation history record
 *   7. Create notification in DB
 *   8. Send escalation email
 *   9. Log audit event
 *
 * @param {String} complaintId - Complaint ID
 * @param {Object} options - { reason, escalatedBy, notes, req }
 * @returns {Object|null} - Updated complaint or null if skipped
 */
async function escalateComplaint(complaintId, options = {}) {
    try {
        const complaint = await Complaint.findById(complaintId)
            .populate('assignedTo', 'name email role')
            .populate('userId', 'name email');

        if (!complaint) {
            throw new Error('Complaint not found');
        }

        // Don't escalate if already resolved/closed
        if (['RESOLVED', 'CLOSED'].includes(complaint.status)) {
            return null;
        }

        // Don't escalate beyond max level
        if (complaint.escalationLevel >= MAX_ESCALATION_LEVEL) {
            console.log(`[SLA] Complaint ${complaintId} already at max escalation level (${MAX_ESCALATION_LEVEL})`);
            return null;
        }

        const now = new Date();
        const previousPriority = complaint.priority;
        const previousAssignee = complaint.assignedTo;
        const previousAssigneeId = previousAssignee?._id || previousAssignee;

        // ── 1. Bump escalation level ────────────────────────────
        complaint.escalationLevel += 1;
        complaint.escalationCount = (complaint.escalationCount || 0) + 1;
        complaint.isEscalated = true;
        complaint.escalated = true;
        complaint.escalatedAt = now;

        // ── 2. Bump priority if not already Critical ────────────
        let newPriority = previousPriority;
        if (previousPriority !== 'Critical') {
            const priorityHierarchy = { Low: 1, Medium: 2, High: 3, Critical: 4 };
            const currentLevel = priorityHierarchy[previousPriority];
            newPriority = Object.keys(priorityHierarchy).find(
                key => priorityHierarchy[key] === Math.min(currentLevel + 1, 4)
            );
            complaint.priority = newPriority;
        }

        // ── 3. Smart Reassignment ────────────────────────────────
        const newAgent = await findBestAgentForEscalation(
            complaint.escalationLevel,
            previousAssigneeId?.toString()
        );

        if (newAgent) {
            complaint.assignedTo = newAgent._id;
            complaint.assignedAt = now;
        }

        // ── 4. Extend SLA deadline ───────────────────────────────
        const extensionMs = ESCALATION_SLA_EXTENSION_MINUTES * 60 * 1000;
        complaint.slaDeadline = new Date(now.getTime() + extensionMs);

        // ── 5. Update status to ESCALATED ────────────────────────
        if (complaint.status !== 'IN_PROGRESS') {
            complaint.status = 'ESCALATED';
        }

        // ── 6. Add escalation history record ─────────────────────
        const escalationRecord = {
            escalatedAt: now,
            reason: options.reason || 'SLA_EXCEEDED',
            previousPriority: previousPriority,
            newPriority: newPriority,
            previousAssignee: previousAssigneeId || null,
            newAssignee: newAgent?._id || null,
            escalationLevel: complaint.escalationLevel,
            escalatedBy: options.escalatedBy || null,
            notes: options.notes || getEscalationReason(complaint, previousPriority)
        };
        complaint.escalationHistory.push(escalationRecord);

        await complaint.save();

        // ── 7. Create notification in DB ─────────────────────────
        const notificationRecipient = newAgent?._id || previousAssigneeId;
        if (notificationRecipient) {
            try {
                const shortId = String(complaint._id).slice(-6).toUpperCase();
                await Notification.create({
                    recipientId: notificationRecipient,
                    complaintId: complaint._id,
                    type: 'ESCALATION',
                    title: `⚠️ Escalation Alert — Complaint #${shortId}`,
                    message: `Complaint "${complaint.title}" has been escalated to Level ${complaint.escalationLevel}. ` +
                        `Priority: ${previousPriority} → ${newPriority}. ` +
                        `Please take immediate action.`,
                    priority: newPriority,
                    metadata: {
                        escalationLevel: complaint.escalationLevel,
                        previousAssignee: previousAssignee?.name || 'Unassigned',
                        newAssignee: newAgent?.name || 'Unchanged',
                        previousPriority,
                        newPriority,
                        slaDeadline: complaint.slaDeadline,
                        overdueBy: getTimeUntilSLADeadline(complaint).overdueDuration || 'N/A'
                    }
                });
            } catch (notifErr) {
                console.error('[SLA] Error creating notification:', notifErr.message);
            }
        }

        // ── 8. Send escalation email ─────────────────────────────
        const recipientEmail = newAgent?.email || previousAssignee?.email;
        if (recipientEmail) {
            try {
                await sendEscalationEmail(recipientEmail, complaint, {
                    escalationLevel: complaint.escalationLevel,
                    previousPriority,
                    newPriority,
                    previousAssignee: previousAssignee?.name || 'Unassigned',
                    newAssignee: newAgent?.name || 'Unchanged',
                    overdueBy: getTimeUntilSLADeadline(complaint).overdueDuration || 'N/A'
                });
            } catch (emailErr) {
                console.error('[SLA] Error sending escalation email:', emailErr.message);
            }
        }

        // ── 9. Log audit event ───────────────────────────────────
        if (options.req) {
            try {
                await logEscalation(
                    options.req.userId,
                    complaint._id,
                    complaint,
                    previousPriority,
                    newPriority,
                    options.req
                );
            } catch (auditError) {
                console.error('[SLA] Error logging escalation audit:', auditError.message);
            }
        }

        return {
            complaint,
            escalationRecord,
            newAgent,
            previousAssignee: previousAssignee?.name || null
        };
    } catch (error) {
        console.error('[SLA] Error escalating complaint:', error);
        throw error;
    }
}

/**
 * Get escalation reason text.
 */
function getEscalationReason(complaint, previousPriority) {
    const slaConfig = SLA_DEFINITIONS[previousPriority || complaint.priority];
    if (!slaConfig) return 'SLA Exceeded';

    return `SLA Exceeded — ${previousPriority || complaint.priority} priority complaint exceeded ` +
        `${slaConfig.hours}-hour SLA. Escalated to Level ${complaint.escalationLevel}.`;
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER: BATCH ESCALATION CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Check for all complaints exceeding SLA and escalate them.
 * This is the main function called by the scheduler.
 *
 * Finds complaints where:
 *   - status is NOT 'RESOLVED' or 'CLOSED'
 *   - current time > slaDeadline
 *   - escalationLevel < MAX_ESCALATION_LEVEL
 *
 * @returns {Object} - { escalatedCount, details, timestamp }
 */
async function checkAndEscalateDueComplaints() {
    try {
        const now = new Date();

        const overdueComplaints = await Complaint.find({
            status: { $nin: ['RESOLVED', 'CLOSED'] },
            slaDeadline: { $lt: now },
            escalationLevel: { $lt: MAX_ESCALATION_LEVEL }
        })
            .populate('assignedTo', 'name email role')
            .populate('userId', 'name email');

        const escalationResults = [];

        for (const complaint of overdueComplaints) {
            try {
                const result = await escalateComplaint(complaint._id, {
                    reason: 'SLA_EXCEEDED',
                    notes: getEscalationReason(complaint, complaint.priority)
                });

                if (result) {
                    escalationResults.push({
                        complaintId: complaint._id,
                        title: complaint.title,
                        priority: result.escalationRecord.previousPriority,
                        newPriority: result.escalationRecord.newPriority,
                        escalationLevel: result.complaint.escalationLevel,
                        assignedTo: result.newAgent?.name || 'Unchanged',
                        previousAssignee: result.previousAssignee || 'Unassigned',
                        slaDeadline: complaint.slaDeadline,
                        overdueBy: formatDuration(now - complaint.slaDeadline)
                    });
                }
            } catch (error) {
                console.error(`[SLA] Failed to escalate complaint ${complaint._id}:`, error.message);
            }
        }

        return {
            escalatedCount: escalationResults.length,
            details: escalationResults,
            totalOverdue: overdueComplaints.length,
            timestamp: now
        };
    } catch (error) {
        console.error('[SLA] Error checking for SLA violations:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get SLA status for a complaint (used by API).
 */
function getSLAStatus(complaint) {
    const timeInfo = getTimeUntilSLADeadline(complaint);
    const slaConfig = SLA_DEFINITIONS[complaint.priority] || SLA_DEFINITIONS.Medium;

    let statusLabel = 'On Track';
    if (complaint.isEscalated) {
        statusLabel = 'Escalated';
    } else if (timeInfo.isOverdue) {
        statusLabel = 'Breached';
    } else if (timeInfo.urgency === 'critical') {
        statusLabel = 'Critical — Less than 10% time left';
    } else if (timeInfo.urgency === 'warning') {
        statusLabel = 'Warning — Less than 25% time left';
    }

    return {
        status: statusLabel,
        priority: complaint.priority,
        slaDurationMinutes: slaConfig.minutes,
        slaDurationHours: slaConfig.hours,
        slaDeadline: complaint.slaDeadline,
        timeRemaining: timeInfo,
        isEscalated: complaint.isEscalated,
        escalationLevel: complaint.escalationLevel || 0,
        escalatedAt: complaint.escalatedAt,
        escalationHistory: complaint.escalationHistory,
        createdAt: complaint.createdAt
    };
}

/**
 * Get SLA metrics for dashboard.
 */
async function getSLAMetrics() {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

        const [totalComplaints, onTrack, atRisk, overdue, escalated, resolvedOnTime, resolvedLate] = await Promise.all([
            Complaint.countDocuments({ status: { $nin: ['RESOLVED', 'CLOSED'] } }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $gt: oneHourFromNow }
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $gt: now, $lte: oneHourFromNow }
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: false,
                slaDeadline: { $lt: now }
            }),
            Complaint.countDocuments({
                status: { $nin: ['RESOLVED', 'CLOSED'] },
                isEscalated: true
            }),
            // Resolved within SLA
            Complaint.countDocuments({
                status: { $in: ['RESOLVED', 'CLOSED'] },
                $expr: { $lte: ['$updatedAt', '$slaDeadline'] }
            }),
            // Resolved after SLA breach
            Complaint.countDocuments({
                status: { $in: ['RESOLVED', 'CLOSED'] },
                $expr: { $gt: ['$updatedAt', '$slaDeadline'] }
            })
        ]);

        const totalResolved = resolvedOnTime + resolvedLate;

        return {
            totalOpenComplaints: totalComplaints,
            onTrack,
            atRisk,
            overdue,
            escalated,
            resolvedOnTime,
            resolvedLate,
            slaCompliance: totalComplaints > 0
                ? ((onTrack / totalComplaints) * 100).toFixed(2) + '%'
                : '100%',
            resolutionCompliance: totalResolved > 0
                ? ((resolvedOnTime / totalResolved) * 100).toFixed(2) + '%'
                : 'N/A'
        };
    } catch (error) {
        console.error('[SLA] Error getting SLA metrics:', error);
        throw error;
    }
}

/**
 * Update SLA deadline when priority changes.
 */
function updateSLADeadlineForPriorityChange(complaint, newPriority) {
    const oldDeadline = complaint.slaDeadline;
    const slaConfig = SLA_DEFINITIONS[newPriority] || SLA_DEFINITIONS.Medium;
    complaint.slaDuration = slaConfig.minutes;
    complaint.slaDeadline = calculateSLADeadline(newPriority, complaint.createdAt);
    return {
        oldDeadline,
        newDeadline: complaint.slaDeadline,
        priorityChanged: true
    };
}

module.exports = {
    SLA_DEFINITIONS,
    MAX_ESCALATION_LEVEL,
    ESCALATION_SLA_EXTENSION_MINUTES,
    calculateSLADeadline,
    getSLADurationMinutes,
    isOverSLA,
    getTimeUntilSLADeadline,
    getEscalationReason,
    escalateComplaint,
    checkAndEscalateDueComplaints,
    getSLAStatus,
    getSLAMetrics,
    updateSLADeadlineForPriorityChange,
    formatDuration,
    findBestAgentForEscalation,
    findLeastLoadedUserByRole
};
