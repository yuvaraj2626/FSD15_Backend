/**
 * ═══════════════════════════════════════════════════════════════
 * SLA Scheduler — Production-Grade Auto-Escalation Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * Uses node-cron for reliable scheduling.
 * Fallback to setInterval if node-cron is unavailable.
 *
 * Default: Checks for SLA violations every 5 minutes.
 */

const { checkAndEscalateDueComplaints } = require('../utils/slaHelper');

let cronJob = null;
let intervalInstance = null;
let isRunning = false;
let useCron = false;

// Scheduler statistics
const stats = {
    lastRun: null,
    nextRun: null,
    totalRuns: 0,
    totalEscalations: 0,
    errors: [],
    startedAt: null
};

/**
 * Initialize and start the SLA scheduler.
 *
 * Tries to use node-cron first (preferred), falls back to setInterval.
 *
 * @param {Number} intervalMs - Interval in milliseconds (default: 5 min)
 * @returns {Object} - Controller with start, stop, status, forceRun
 */
function initializeScheduler(intervalMs = 5 * 60 * 1000) {
    return {
        start: () => startScheduler(intervalMs),
        stop: () => stopScheduler(),
        status: () => getSchedulerStatus(intervalMs),
        forceRun: () => runEscalationCheck()
    };
}

/**
 * Start the scheduler.
 */
function startScheduler(intervalMs) {
    if (isRunning) {
        console.warn('[SLA Scheduler] Scheduler is already running');
        return { message: 'Already running' };
    }

    isRunning = true;
    stats.startedAt = new Date();

    // Try node-cron first
    try {
        const cron = require('node-cron');

        // Convert intervalMs to cron expression
        const intervalMinutes = Math.max(1, Math.round(intervalMs / 60000));
        const cronExpression = `*/${intervalMinutes} * * * *`;

        cronJob = cron.schedule(cronExpression, async () => {
            await runEscalationCheck();
        }, {
            scheduled: true,
            timezone: process.env.TZ || 'UTC'
        });

        useCron = true;
        console.log(`[SLA Scheduler] ✅ Started with node-cron (every ${intervalMinutes} min): ${cronExpression}`);
    } catch (cronError) {
        // Fallback to setInterval
        console.warn('[SLA Scheduler] node-cron not available, using setInterval fallback');

        intervalInstance = setInterval(async () => {
            await runEscalationCheck();
        }, intervalMs);

        useCron = false;
        console.log(`[SLA Scheduler] ✅ Started with setInterval (every ${(intervalMs / 60000).toFixed(1)} min)`);
    }

    // Run immediately on start
    setTimeout(() => runEscalationCheck(), 2000);

    return {
        message: 'SLA Scheduler started',
        engine: useCron ? 'node-cron' : 'setInterval',
        interval: `${(intervalMs / 60000).toFixed(1)} minutes`,
        startedAt: stats.startedAt
    };
}

/**
 * Stop the scheduler.
 */
function stopScheduler() {
    if (!isRunning) {
        console.warn('[SLA Scheduler] Scheduler is not running');
        return { message: 'Not running' };
    }

    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
    if (intervalInstance) {
        clearInterval(intervalInstance);
        intervalInstance = null;
    }

    isRunning = false;
    console.log('[SLA Scheduler] ⏹️ SLA Scheduler stopped');

    return {
        message: 'SLA Scheduler stopped',
        totalRuns: stats.totalRuns,
        totalEscalations: stats.totalEscalations
    };
}

/**
 * Run a single escalation check cycle.
 */
async function runEscalationCheck() {
    const startTime = Date.now();
    stats.lastRun = new Date();

    try {
        console.log(`\n[SLA Scheduler] ─── Escalation check at ${stats.lastRun.toISOString()} ───`);

        const result = await checkAndEscalateDueComplaints();

        stats.totalRuns++;
        stats.totalEscalations += result.escalatedCount;

        if (result.escalatedCount > 0) {
            console.log(`[SLA Scheduler] 🚨 Escalated ${result.escalatedCount} complaint(s):`);
            result.details.forEach(detail => {
                console.log(
                    `  → ID: ${detail.complaintId}, ` +
                    `"${detail.title}", ` +
                    `${detail.priority} → ${detail.newPriority}, ` +
                    `Level ${detail.escalationLevel}, ` +
                    `Assigned: ${detail.assignedTo}, ` +
                    `Overdue: ${detail.overdueBy}`
                );
            });
        } else {
            console.log('[SLA Scheduler] ✅ No SLA violations found');
        }

        const duration = Date.now() - startTime;
        console.log(`[SLA Scheduler] ─── Completed in ${duration}ms ───\n`);

        return result;
    } catch (error) {
        console.error('[SLA Scheduler] ❌ Error during escalation check:', error.message);
        stats.errors.push({
            timestamp: new Date(),
            error: error.message
        });

        // Keep only last 10 errors
        if (stats.errors.length > 10) {
            stats.errors.shift();
        }

        return { escalatedCount: 0, details: [], error: error.message };
    }
}

/**
 * Get scheduler status for monitoring endpoints.
 */
function getSchedulerStatus(intervalMs) {
    return {
        isRunning,
        engine: useCron ? 'node-cron' : 'setInterval',
        intervalMs: intervalMs || (5 * 60 * 1000),
        interval: `${((intervalMs || 5 * 60 * 1000) / 60000).toFixed(1)} minutes`,
        startedAt: stats.startedAt,
        lastRun: stats.lastRun,
        totalRuns: stats.totalRuns,
        totalEscalations: stats.totalEscalations,
        recentErrors: stats.errors.slice(-5),
        uptime: stats.startedAt
            ? `${Math.round((Date.now() - stats.startedAt.getTime()) / 60000)} minutes`
            : null
    };
}

module.exports = {
    initializeScheduler,
    startScheduler,
    stopScheduler,
    runEscalationCheck,
    getSchedulerStatus,
    isSchedulerRunning: () => isRunning
};
