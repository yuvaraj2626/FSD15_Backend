/**
 * SLA Scheduler
 * Runs periodic checks for SLA violations and escalates complaints
 * Can be triggered via node-cron or setInterval
 */

const { checkAndEscalateDueComplaints } = require('../utils/slaHelper');

let schedulerInstance = null;
let isRunning = false;

/**
 * Initialize the SLA scheduler with an interval (in milliseconds)
 * Default: runs every 5 minutes
 * @param {Number} intervalMs - Interval in milliseconds (default: 5 * 60 * 1000)
 * @returns {Object} - { start, stop, status }
 */
function initializeScheduler(intervalMs = 5 * 60 * 1000) {
    const scheduler = {
        intervalMs,
        lastRun: null,
        nextRun: null,
        totalRuns: 0,
        totalEscalations: 0,
        errors: []
    };

    return {
        start: () => startScheduler(scheduler, intervalMs),
        stop: () => stopScheduler(),
        status: () => getSchedulerStatus(scheduler),
        forceRun: () => runEscalationCheck(scheduler)
    };
}

/**
 * Start the scheduler
 * @param {Object} scheduler - Scheduler state object
 * @param {Number} intervalMs - Interval in milliseconds
 */
function startScheduler(scheduler, intervalMs) {
    if (isRunning) {
        console.warn('[SLA Scheduler] Scheduler is already running');
        return;
    }

    isRunning = true;
    console.log(`[SLA Scheduler] Starting SLA checker (interval: ${intervalMs}ms)`);

    // Run immediately on start
    runEscalationCheck(scheduler);

    // Set up interval
    schedulerInstance = setInterval(() => {
        runEscalationCheck(scheduler);
    }, intervalMs);

    return {
        message: 'SLA Scheduler started',
        interval: `${(intervalMs / 1000 / 60).toFixed(1)} minutes`,
        nextCheck: new Date(Date.now() + intervalMs)
    };
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
    if (!isRunning) {
        console.warn('[SLA Scheduler] Scheduler is not running');
        return;
    }

    if (schedulerInstance) {
        clearInterval(schedulerInstance);
        schedulerInstance = null;
    }

    isRunning = false;
    console.log('[SLA Scheduler] SLA Scheduler stopped');

    return { message: 'SLA Scheduler stopped' };
}

/**
 * Run a single escalation check
 * @param {Object} scheduler - Scheduler state object
 */
async function runEscalationCheck(scheduler) {
    try {
        const startTime = Date.now();
        scheduler.lastRun = new Date();
        scheduler.nextRun = new Date(startTime + scheduler.intervalMs);

        console.log(`\n[SLA Scheduler] Running escalation check at ${scheduler.lastRun.toISOString()}`);

        const result = await checkAndEscalateDueComplaints();

        scheduler.totalRuns++;
        scheduler.totalEscalations += result.escalatedCount;

        if (result.escalatedCount > 0) {
            console.log(`[SLA Scheduler] ✓ Escalated ${result.escalatedCount} complaint(s)`);
            result.details.forEach(complaint => {
                console.log(
                    `  - ID: ${complaint.complaintId}, Title: "${complaint.title}", ` +
                    `Priority: ${complaint.priority} → ${complaint.newPriority}, ` +
                    `Overdue: ${complaint.overdueBy}`
                );
            });
        } else {
            console.log('[SLA Scheduler] ✓ No complaints exceeding SLA');
        }

        const duration = Date.now() - startTime;
        console.log(`[SLA Scheduler] Check completed in ${duration}ms\n`);

        return result;
    } catch (error) {
        console.error('[SLA Scheduler] Error during escalation check:', error.message);
        scheduler.errors.push({
            timestamp: new Date(),
            error: error.message
        });

        // Keep only last 10 errors
        if (scheduler.errors.length > 10) {
            scheduler.errors.shift();
        }

        throw error;
    }
}

/**
 * Get current scheduler status
 * @param {Object} scheduler - Scheduler state object
 * @returns {Object} - Scheduler status information
 */
function getSchedulerStatus(scheduler) {
    return {
        isRunning,
        intervalMs: scheduler.intervalMs,
        interval: `${(scheduler.intervalMs / 1000 / 60).toFixed(1)} minutes`,
        lastRun: scheduler.lastRun,
        nextRun: scheduler.nextRun,
        totalRuns: scheduler.totalRuns,
        totalEscalations: scheduler.totalEscalations,
        recentErrors: scheduler.errors.slice(-5)
    };
}

/**
 * Alternative: Create a cron-based scheduler (requires node-cron package)
 * Uncomment and use if you prefer cron scheduling
 */
function initializeCronScheduler() {
    // To use this, install node-cron: npm install node-cron
    // const cron = require('node-cron');
    //
    // const cronScheduler = {
    //     // Run every 5 minutes
    //     task: cron.schedule('*/5 * * * *', async () => {
    //         console.log('[SLA Cron] Running escalation check');
    //         try {
    //             const result = await checkAndEscalateDueComplaints();
    //             if (result.escalatedCount > 0) {
    //                 console.log(`[SLA Cron] Escalated ${result.escalatedCount} complaint(s)`);
    //             }
    //         } catch (error) {
    //             console.error('[SLA Cron] Error:', error.message);
    //         }
    //     }),
    //     stop: () => {
    //         cronScheduler.task.stop();
    //         console.log('[SLA Cron] Scheduler stopped');
    //     }
    // };
    //
    // return cronScheduler;
}

module.exports = {
    initializeScheduler,
    startScheduler,
    stopScheduler,
    runEscalationCheck,
    getSchedulerStatus,
    isSchedulerRunning: () => isRunning,
    initializeCronScheduler
};
