/**
 * Email Notification Service
 * 
 * Uses Nodemailer to send transactional emails for key complaint events.
 * Supported events:
 *   - Complaint created  → user confirmation
 *   - Complaint resolved  → user notification
 *   - Complaint assigned  → support agent notification
 * 
 * Configure via .env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */

const nodemailer = require('nodemailer');

// ── Transporter (lazy-init singleton) ─────────────────────────
let transporter = null;

/**
 * Get or create the SMTP transporter.
 * Falls back gracefully when credentials are missing (dev mode).
 */
function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.warn('⚠️  EMAIL_USER / EMAIL_PASS not set — emails will be logged but NOT sent.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: { user, pass }
    });

    // Verify connection on first use
    transporter.verify()
        .then(() => console.log('📧 SMTP transporter ready'))
        .catch(err => console.error('❌ SMTP verification failed:', err.message));

    return transporter;
}

// ── Template helpers ─────────────────────────────────────────

const APP_NAME = 'Complaint Management System';
const FROM = () => process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@cms.local';

/**
 * Base HTML wrapper — shared layout for all emails.
 */
function htmlWrapper(title, bodyHtml) {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
    body { margin:0; padding:0; background:#0f0c28; font-family:'Segoe UI',Arial,sans-serif; color:#e2e8f0; }
    .container { max-width:600px; margin:0 auto; padding:24px; }
    .card { background:rgba(30,27,75,0.95); border-radius:16px; border:1px solid rgba(124,58,237,0.25); padding:32px; }
    .header { text-align:center; padding-bottom:20px; border-bottom:1px solid rgba(124,58,237,0.2); margin-bottom:24px; }
    .header h1 { margin:0; font-size:22px; background:linear-gradient(135deg,#7c3aed,#a855f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; text-transform:uppercase; }
    .badge-open { background:rgba(6,182,212,0.15); color:#06b6d4; }
    .badge-resolved { background:rgba(16,185,129,0.15); color:#10b981; }
    .badge-assigned { background:rgba(245,158,11,0.15); color:#f59e0b; }
    .detail-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
    .detail-label { color:#94a3b8; font-size:13px; }
    .detail-value { color:#e2e8f0; font-size:13px; font-weight:500; }
    .cta { display:inline-block; margin-top:20px; padding:12px 28px; background:linear-gradient(135deg,#7c3aed,#a855f7); color:#fff; text-decoration:none; border-radius:10px; font-weight:600; }
    .footer { text-align:center; margin-top:24px; font-size:12px; color:#64748b; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <h1>📋 ${APP_NAME}</h1>
    </div>
    ${bodyHtml}
  </div>
  <div class="footer">
    This is an automated notification. Please do not reply to this email.
  </div>
</div>
</body>
</html>`;
}

// ── Public Email Functions ───────────────────────────────────

/**
 * Send email when a new complaint is created.
 * @param {String} toEmail  - User's email
 * @param {Object} complaint - Complaint document (populated)
 * @param {Object} priorityInfo - priority detection result
 */
async function sendComplaintCreatedEmail(toEmail, complaint, priorityInfo = {}) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `Complaint #${shortId} Received — ${complaint.title}`;

    const body = `
        <h2 style="margin-top:0">Your complaint has been received!</h2>
        <p style="color:#94a3b8">We've recorded your complaint and our team will review it shortly.</p>
        
        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${complaint.priority}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-open">OPEN</span></span></div>
        ${priorityInfo.detectedFrom === 'intelligent_detection'
            ? `<div class="detail-row"><span class="detail-label">Auto-detected</span><span class="detail-value">Priority set by AI (confidence: ${Math.round((priorityInfo.confidence || 0) * 100)}%)</span></div>`
            : ''
        }
        
        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            📝 <em>${complaint.description.substring(0, 150)}${complaint.description.length > 150 ? '...' : ''}</em>
        </p>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

/**
 * Send email when a complaint is resolved.
 * @param {String} toEmail   - User's email
 * @param {Object} complaint - Complaint document (populated)
 */
async function sendComplaintResolvedEmail(toEmail, complaint) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `Complaint #${shortId} Resolved ✅ — ${complaint.title}`;

    const body = `
        <h2 style="margin-top:0">Your complaint has been resolved! ✅</h2>
        <p style="color:#94a3b8">Great news — our team has resolved your complaint.</p>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-resolved">RESOLVED</span></span></div>

        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            If you're satisfied with the resolution, you can leave feedback on the dashboard.<br>
            If the issue persists, you can reopen the complaint by contacting support.
        </p>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

/**
 * Send email when a complaint is assigned to a support agent.
 * @param {String} toEmail   - Support agent's email
 * @param {Object} complaint - Complaint document (populated)
 */
async function sendComplaintAssignedEmail(toEmail, complaint) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `New Assignment — Complaint #${shortId}: ${complaint.title}`;

    const body = `
        <h2 style="margin-top:0">You've been assigned a complaint 📝</h2>
        <p style="color:#94a3b8">A complaint has been assigned to you. Please review it at your earliest convenience.</p>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${complaint.priority}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-assigned">ASSIGNED</span></span></div>

        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            📝 <em>${complaint.description.substring(0, 200)}${complaint.description.length > 200 ? '...' : ''}</em>
        </p>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

/**
 * Send email to support team when a new complaint is created.
 * @param {String} toEmail   - Support agent's email
 * @param {Object} complaint - Complaint document (populated)
 */
async function sendSupportTeamNewComplaintEmail(toEmail, complaint) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `New Complaint Created — #${shortId}: ${complaint.title}`;

    const body = `
        <h2 style="margin-top:0">New complaint received 📥</h2>
        <p style="color:#94a3b8">A new complaint has been created and is ready for review.</p>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${complaint.priority}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-open">OPEN</span></span></div>

        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            📝 <em>${complaint.description.substring(0, 200)}${complaint.description.length > 200 ? '...' : ''}</em>
        </p>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

/**
 * Send email when a complaint is closed.
 * @param {String} toEmail   - User's email
 * @param {Object} complaint - Complaint document (populated)
 */
async function sendComplaintClosedEmail(toEmail, complaint) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `Complaint #${shortId} Closed ✅ — ${complaint.title}`;

    const body = `
        <h2 style="margin-top:0">Your complaint has been closed ✅</h2>
        <p style="color:#94a3b8">Your issue has been marked complete and closed.</p>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-resolved">CLOSED</span></span></div>

        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            If you need further help, you can create a new complaint or contact support.
        </p>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

// ── Escalation Email ──────────────────────────────────────────

/**
 * Send email when a complaint is escalated due to SLA breach.
 * @param {String} toEmail    - Recipient email (new assignee or admin)
 * @param {Object} complaint  - Complaint document (populated)
 * @param {Object} escalation - Escalation details
 */
async function sendEscalationEmail(toEmail, complaint, escalation = {}) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `🚨 ESCALATION — Complaint #${shortId}: ${complaint.title} [Level ${escalation.escalationLevel || 1}]`;

    const levelColors = {
        1: '#f59e0b',  // Yellow
        2: '#f97316',  // Orange
        3: '#ef4444'   // Red
    };
    const levelColor = levelColors[escalation.escalationLevel] || '#ef4444';

    const body = `
        <h2 style="margin-top:0;color:${levelColor}">🚨 Complaint Escalated — Level ${escalation.escalationLevel || 1}</h2>
        <p style="color:#94a3b8">A complaint has been automatically escalated due to SLA breach. Immediate attention is required.</p>

        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px;margin:16px 0">
            <div style="font-weight:700;color:${levelColor};margin-bottom:8px">⏰ SLA BREACHED</div>
            <div style="color:#e2e8f0;font-size:14px">
                Overdue: <strong>${escalation.overdueBy || 'N/A'}</strong><br>
                New Deadline: <strong>${complaint.slaDeadline ? new Date(complaint.slaDeadline).toLocaleString() : 'Extended'}</strong>
            </div>
        </div>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${complaint.category}</span></div>
        <div class="detail-row"><span class="detail-label">Priority Change</span><span class="detail-value">${escalation.previousPriority || complaint.priority} → <strong>${escalation.newPriority || complaint.priority}</strong></span></div>
        <div class="detail-row"><span class="detail-label">Escalation Level</span><span class="detail-value"><strong>Level ${escalation.escalationLevel || 1}</strong> of 3</span></div>
        <div class="detail-row"><span class="detail-label">Previous Assignee</span><span class="detail-value">${escalation.previousAssignee || 'Unassigned'}</span></div>
        <div class="detail-row"><span class="detail-label">Reassigned To</span><span class="detail-value"><strong>${escalation.newAssignee || 'You'}</strong></span></div>

        <p style="color:#94a3b8;margin-top:16px;font-size:13px">
            📝 <em>${complaint.description?.substring(0, 200) || ''}${(complaint.description?.length || 0) > 200 ? '...' : ''}</em>
        </p>

        <div style="margin-top:20px;padding:12px 16px;background:rgba(124,58,237,0.1);border-radius:8px;border:1px solid rgba(124,58,237,0.2)">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">ACTION REQUIRED</div>
            <div style="color:#e2e8f0;font-size:14px">
                ${escalation.escalationLevel >= 2
                    ? 'This complaint has been escalated to <strong>Admin level</strong>. Please review and resolve immediately.'
                    : 'Please review and begin working on this complaint as soon as possible.'}
            </div>
        </div>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

// ── SLA Warning Email ────────────────────────────────────────

/**
 * Send email when a complaint is approaching SLA deadline.
 * @param {String} toEmail    - Support agent's email
 * @param {Object} complaint  - Complaint document
 * @param {String} timeLeft   - Human-readable time remaining
 */
async function sendSLAWarningEmail(toEmail, complaint, timeLeft) {
    const shortId = String(complaint._id).slice(-6).toUpperCase();
    const subject = `⚠️ SLA Warning — Complaint #${shortId} deadline approaching`;

    const body = `
        <h2 style="margin-top:0;color:#f59e0b">⚠️ SLA Deadline Approaching</h2>
        <p style="color:#94a3b8">The following complaint is close to its SLA deadline. Please prioritize resolution.</p>

        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:16px;margin:16px 0">
            <div style="font-weight:700;color:#f59e0b;margin-bottom:8px">⏳ TIME REMAINING</div>
            <div style="color:#e2e8f0;font-size:18px;font-weight:700">${timeLeft}</div>
        </div>

        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value">#${shortId}</span></div>
        <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaint.title}</span></div>
        <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${complaint.priority}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${complaint.status}</span></div>
    `;

    await sendMail(toEmail, subject, htmlWrapper(subject, body));
}

// ── Core send function ───────────────────────────────────────

/**
 * Low-level send. Logs to console in dev / when SMTP is not configured.
 */
async function sendMail(to, subject, html) {
    const transport = getTransporter();

    if (!transport) {
        // Dev fallback — log the email to console
        console.log(`\n📧 ── EMAIL (dev preview) ─────────────────`);
        console.log(`   TO:      ${to}`);
        console.log(`   SUBJECT: ${subject}`);
        console.log(`   (HTML body omitted — set EMAIL_USER/EMAIL_PASS to send for real)\n`);
        return { preview: true, to, subject };
    }

    try {
        const info = await transport.sendMail({
            from: `"${APP_NAME}" <${FROM()}>`,
            to,
            subject,
            html
        });
        console.log(`📧 Email sent → ${to} | messageId: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error(`❌ Failed to send email to ${to}:`, err.message);
        // Non-blocking — don't crash the request
        return { error: err.message };
    }
}

module.exports = {
    sendComplaintCreatedEmail,
    sendComplaintResolvedEmail,
    sendComplaintAssignedEmail,
    sendSupportTeamNewComplaintEmail,
    sendComplaintClosedEmail,
    sendEscalationEmail,
    sendSLAWarningEmail,
    sendMail
};
