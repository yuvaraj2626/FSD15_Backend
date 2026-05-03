# SLA & Auto-Escalation System - Complete Testing Guide

## Overview

This guide walks through testing the entire SLA and auto-escalation workflow end-to-end.

---

## Prerequisites

- Node.js & npm installed
- MongoDB running locally or connection string available
- Backend server running on `http://localhost:5000`
- Frontend running on `http://localhost:3000`
- Email configured (optional for testing, logs to console if not)

---

## Setup Instructions

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure Environment

Create `.env` file in the `server/` directory (use `.env.example` as template):

```env
MONGODB_URI=mongodb://localhost:27017/complaints_db
JWT_SECRET=dev-secret-key
JWT_REFRESH_SECRET=dev-refresh-secret
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
SLA_CHECK_INTERVAL_MS=300000

# Email (optional - leave empty to skip email sending)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@complaints.local
```

### 3. Start Services

```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Frontend
cd client
npm start

# Terminal 3 (Optional): Monitor scheduler (tail logs)
tail -f server.log
```

---

## Test Case 1: Create Complaint with Auto-SLA Calculation

### Objective
Verify that SLA deadline is correctly calculated based on priority.

### Steps

1. **Login as USER**
   - URL: `http://localhost:3000/login`
   - Use any user with role USER

2. **Create a new complaint**
   - Navigate to "Create Complaint"
   - Fill form:
     - **Title**: "Database Server Down"
     - **Description**: "The main database is not responding, critical system failure"
     - **Category**: Technical
     - **Priority**: Auto-detect (or select "Critical")

3. **Verify SLA Assignment**
   - Check response for `slaDeadline` field
   - SLA should be: **Current Time + 2 hours** (Critical priority)

### Expected Result

```json
{
  "message": "Complaint created successfully",
  "complaint": {
    "_id": "507f...",
    "title": "Database Server Down",
    "priority": "Critical",
    "slaDeadline": "2026-04-24T14:30:00Z",  // Now + 2 hours
    "isEscalated": false,
    "escalationLevel": 0
  },
  "priorityDetection": {
    "detectedPriority": "Critical",
    "confidence": 0.95
  }
}
```

---

## Test Case 2: View SLA Status

### Objective
Verify SLA countdown timer displays correctly on complaint.

### Steps

1. **Go to Dashboard**
   - Navigate to Complaints/Dashboard

2. **View complaint card**
   - Look for SLATimer component showing countdown
   - Color should be 🟢 **Green** (On Track)

3. **Expand complaint details**
   - Click on complaint to expand
   - Verify full SLATimer card shows:
     - Time remaining (HH:MM:SS format)
     - SLA deadline timestamp
     - Progress percentage
     - Status badge

### Expected UI

```
📋 Database Server Down              [ESCALATED] [Critical] [1h 45m 32s ✅]
```

---

## Test Case 3: Simulate SLA Breach

### Objective
Test that complaints are auto-escalated when SLA deadline is exceeded.

### Steps

**Option A: Manual Testing with Modified Deadline**

1. **Create a complaint with Critical priority** (as in Test Case 1)

2. **Modify the SLA deadline in MongoDB** (simulating time passage):
   ```bash
   # Connect to MongoDB
   mongosh
   
   # Switch to complaints_db
   use complaints_db
   
   # Find the complaint
   db.complaints.findOne({ title: "Database Server Down" })
   
   # Update SLA deadline to past (to trigger immediate escalation)
   db.complaints.updateOne(
     { _id: ObjectId("607f1234567890abcdef1234") },
     { $set: { slaDeadline: new Date(Date.now() - 3600000) } }  // 1 hour ago
   )
   ```

3. **Trigger scheduler manually**
   - Make API call to force run (if endpoint available):
     ```bash
     curl -X POST http://localhost:5000/api/admin/scheduler/force-run \
       -H "Authorization: Bearer ADMIN_TOKEN"
     ```
   - OR wait for next scheduled check (default: 5 minutes)

4. **Check complaint status**
   - Should now show `isEscalated: true`
   - `escalationLevel: 1`
   - Status: ESCALATED
   - SLATimer color: 🔴 **Red** (Breached)

**Option B: Reduce SLA_CHECK_INTERVAL_MS in .env**

```env
SLA_CHECK_INTERVAL_MS=10000  # Check every 10 seconds for testing
```

Then wait ~15 seconds for scheduler to run.

### Expected Result

```json
{
  "complaint": {
    "_id": "607f...",
    "isEscalated": true,
    "escalationLevel": 1,
    "status": "ESCALATED",
    "priority": "High",  // Bumped from Critical → High
    "escalatedAt": "2026-04-24T12:35:00Z",
    "escalationHistory": [
      {
        "escalatedAt": "2026-04-24T12:35:00Z",
        "reason": "SLA_EXCEEDED",
        "previousPriority": "Critical",
        "newPriority": "High",
        "escalationLevel": 1
      }
    ]
  }
}
```

---

## Test Case 4: Check Escalation History

### Objective
Verify escalation history is recorded and displayed.

### Steps

1. **Get complaint details**
   ```bash
   curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID \
     -H "Authorization: Bearer USER_TOKEN"
   ```

2. **Verify escalationHistory array**
   - Should contain one entry with:
     - escalatedAt timestamp
     - previousPriority and newPriority
     - escalationLevel
     - reason
     - previousAssignee and newAssignee

### Expected Response

```json
{
  "complaint": {
    "escalationHistory": [
      {
        "_id": "507f...",
        "escalatedAt": "2026-04-24T12:35:00Z",
        "reason": "SLA_EXCEEDED",
        "previousPriority": "Critical",
        "newPriority": "High",
        "previousAssignee": "507f...user1",
        "newAssignee": "507f...user2",
        "escalationLevel": 1,
        "escalatedBy": null,
        "notes": "Complaint exceeded SLA by 2h 5m"
      }
    ]
  }
}
```

---

## Test Case 5: View SLA-Breached Complaints

### Objective
Verify admin/support can view all SLA-breached complaints.

### Steps

1. **Login as SUPPORT or ADMIN**

2. **Navigate to SLA-Breached view**
   - URL: `http://localhost:3000/complaints?filter=sla-breached`
   - Or use API:
     ```bash
     curl -X GET http://localhost:5000/api/complaints/sla-breached \
       -H "Authorization: Bearer SUPPORT_TOKEN"
     ```

3. **Verify list shows**
   - Only complaints with `slaDeadline < now`
   - Sorted by most overdue first
   - Includes overdue duration (e.g., "2h 5m overdue")

### Expected Response

```json
{
  "message": "SLA-breached complaints retrieved",
  "complaints": [
    {
      "_id": "607f...",
      "title": "Database Server Down",
      "priority": "Critical",
      "status": "ESCALATED",
      "slaDeadline": "2026-04-24T12:30:00Z",
      "isEscalated": true,
      "slaInfo": {
        "isOverdue": true,
        "overdueDuration": "2h 5m overdue",
        "percentage": 100,
        "urgency": "breached"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

## Test Case 6: View SLA Metrics Dashboard

### Objective
Verify admin dashboard shows SLA compliance metrics.

### Steps

1. **Login as ADMIN**

2. **Navigate to Analytics/Admin Dashboard**
   - Should show SLA compliance statistics

3. **Call SLA metrics endpoint**
   ```bash
   curl -X GET http://localhost:5000/api/complaints/sla/metrics \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

### Expected Response

```json
{
  "message": "SLA metrics retrieved",
  "metrics": {
    "totalOpenComplaints": 5,
    "onTrack": 3,
    "atRisk": 1,
    "overdue": 1,
    "escalated": 1,
    "resolvedOnTime": 8,
    "resolvedLate": 2,
    "slaCompliance": "60.00%",
    "resolutionCompliance": "80.00%"
  }
}
```

---

## Test Case 7: Manual Escalation by Admin

### Objective
Verify admin can manually escalate a complaint without waiting for SLA breach.

### Steps

1. **Login as ADMIN**

2. **Create or select an OPEN complaint**

3. **Manually escalate via API**
   ```bash
   curl -X POST http://localhost:5000/api/complaints/COMPLAINT_ID/escalate \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "reason": "MANUAL_ESCALATION",
       "notes": "Customer is VIP, require immediate attention"
     }'
   ```

4. **Verify escalation occurred**
   - Status changed to ESCALATED
   - Priority bumped (Low→Medium→High→Critical)
   - escalationLevel incremented
   - New assignee assigned
   - Email sent to new assignee

### Expected Response

```json
{
  "message": "Complaint escalated successfully",
  "complaint": {
    "escalationLevel": 1,
    "priority": "High",
    "status": "ESCALATED",
    "escalatedAt": "2026-04-24T13:00:00Z",
    "assignedTo": { "name": "Senior Support Agent", "email": "support@example.com" }
  }
}
```

---

## Test Case 8: Multiple Escalation Levels

### Objective
Verify complaint escalates through multiple levels (Level 1 → Level 2 → Level 3).

### Steps

1. **Create High priority complaint** (SLA = 6 hours)

2. **First escalation** (Level 1)
   - Modify deadline to 7 hours ago
   - Run scheduler
   - Verify: priority Medium→High, escalationLevel = 1

3. **Second escalation** (Level 2)
   - Modify deadline to 8 hours ago
   - Run scheduler
   - Verify: priority High→Critical, escalationLevel = 2, assigned to ADMIN

4. **Third escalation** (Level 3 - Final)
   - Modify deadline to 9 hours ago
   - Run scheduler
   - Verify: escalationLevel = 3, no further escalation

5. **Try fourth escalation** (should fail)
   - Modify deadline to 10 hours ago
   - Run scheduler
   - Verify: escalationLevel stays at 3, no change

### Expected Flow

```
Level 0: Medium priority, assigned to Support A
         ↓ (SLA exceeded)
Level 1: High priority, assigned to Senior Support
         ↓ (SLA exceeded)
Level 2: Critical priority, assigned to Admin
         ↓ (SLA exceeded)
Level 3: Critical priority, assigned to Admin (final)
         ↓ (SLA exceeded)
         No further escalation (max reached)
```

---

## Test Case 9: Email Notifications

### Objective
Verify emails are sent on escalation events.

### Steps

1. **Check email configuration** in .env
   - Ensure EMAIL_HOST, EMAIL_USER, EMAIL_PASS are set

2. **Create and escalate a complaint** (as in Test Case 7)

3. **Check email inbox**
   - Should receive escalation email to new assignee

4. **Email content should include**
   - Complaint ID & title
   - Priority level
   - Escalation reason
   - SLA deadline & overdue duration
   - Action link to complaint dashboard

### Sample Email

```
Subject: 🚨 ESCALATION — Complaint #A1B2C3: Database Server Down [Level 2]

Body:
Your complaint has been escalated to level 2. Immediate action required.

Complaint ID: #A1B2C3
Title: Database Server Down
Priority: Critical (escalated from High)
SLA Deadline: 2026-04-24T14:30:00Z
Overdue By: 2h 15m
Escalation Level: 2

Please respond immediately to resolve this critical issue.
...
```

---

## Test Case 10: Real-Time Updates via Socket.io

### Objective
Verify real-time notifications are sent on escalation.

### Steps

1. **Open browser console** on frontend

2. **Create and escalate complaint** (backend)

3. **Monitor Socket.io events** in console
   ```javascript
   // In browser console, these events should fire:
   // - complaintEscalated
   // - complaint:escalated
   ```

4. **Check frontend UI updates in real-time**
   - Complaint list should show updated status/priority
   - SLA timer color should change to red
   - Escalation badge should appear

---

## Test Case 11: SLA Timer Visual Indicators

### Objective
Verify SLATimer component shows correct color states.

### Steps

1. **Create complaints with different priorities**

   - Low priority (48h SLA)
   - Medium priority (24h SLA)
   - High priority (6h SLA)
   - Critical priority (2h SLA)

2. **Check SLA timer colors**

   | Time Remaining | Color | Urgency |
   |---|---|---|
   | 0-50% elapsed | 🟢 Green | On Track |
   | 50-75% elapsed | 🟡 Yellow | Caution |
   | 75-90% elapsed | 🟠 Orange | Warning |
   | >90% elapsed | 🔴 Red | Critical |
   | Deadline passed | 🔴 Red | Breached |

3. **Verify countdown updates in real-time**
   - Timer should decrement every second
   - Color should change as threshold approaches

---

## Test Case 12: Priority Detection

### Objective
Verify intelligent priority detection based on keywords.

### Steps

1. **Create complaints with various titles/descriptions**

   - "Website is DOWN" → Should detect High
   - "Payment system not working" → Should detect High
   - "Slow performance" → Should detect Medium
   - "Minor typo in UI" → Should detect Low

2. **Verify detected priority**
   - Check response for `detectedPriority` and `confidence`

3. **Verify user can override**
   - Change priority manually if needed
   - SLA should recalculate

---

## Test Case 13: Resolve Before SLA Breach

### Objective
Verify no escalation occurs if complaint resolved before SLA deadline.

### Steps

1. **Create complaint** (e.g., Critical priority = 2h SLA)

2. **Immediately resolve it**
   - Update status to RESOLVED

3. **Wait for scheduler to run** (or force run)

4. **Verify no escalation occurred**
   - isEscalated should still be false
   - escalationLevel should be 0
   - Should show in "Resolved On Time" metrics

---

## Test Case 14: Resolve After SLA Breach (Late Resolution)

### Objective
Verify resolution after SLA breach is tracked separately in metrics.

### Steps

1. **Create and escalate complaint** (as in Test Case 3)

2. **Resolve the complaint**
   - Update status to RESOLVED

3. **Check analytics metrics**
   - Should show in "resolvedLate" count
   - Resolution compliance should decrease

---

## Scheduler Verification

### Check Scheduler is Running

**In server console:**
```
[SLA Scheduler] ✅ Started with node-cron (every 5 min): */5 * * * *
[SLA Scheduler] Running escalation check at 2026-04-24T12:35:00Z
[SLA Scheduler] ✓ Escalated 2 complaint(s)
  - ID: 507f..., Title: "Database Down", Medium → High
[SLA Scheduler] Check completed in 47ms
```

**API endpoint to check scheduler status:**
```bash
curl -X GET http://localhost:5000/api/scheduler/status \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Troubleshooting

### Escalation Not Triggering

**Issue**: Complaints not auto-escalating even though SLA deadline passed

**Solutions**:
1. Verify scheduler is running (check console logs)
2. Check `SLA_CHECK_INTERVAL_MS` env var is set correctly
3. Verify MongoDB connection working
4. Check complaint's `slaDeadline` field exists and is Date type
5. Force run scheduler: `node -e "require('./scheduler/slaScheduler').forceRun()"`

### Emails Not Sending

**Issue**: No emails received on escalation

**Solutions**:
1. Check EMAIL_* env vars are set correctly
2. For Gmail: Use "App Passwords" (not regular password)
3. Check logs for Nodemailer errors
4. Test email: `npm run test:email`
5. Temporarily disable email requirement in .env

### Socket.io Events Not Received

**Issue**: Real-time updates not showing on frontend

**Solutions**:
1. Check WebSocket connection in browser DevTools
2. Verify frontend and backend have same Socket.io URL
3. Check CORS settings allow WebSocket
4. Verify user is registered with Socket (socket.emit('register', userId))

---

## Performance Testing

### Load Test SLA Scheduler

```bash
# Create 100 complaints with various priorities
node test-priority-detection.js

# Verify scheduler handles bulk escalations
# Check logs for completion time and memory usage
```

---

## Integration Checklist

- [ ] .env configured with all required variables
- [ ] MongoDB connection working
- [ ] Backend server starts without errors
- [ ] Frontend connects to backend successfully
- [ ] Can create complaints
- [ ] SLA deadline calculated correctly for each priority
- [ ] SLATimer displays correctly with live countdown
- [ ] Scheduler starts and runs automatically
- [ ] Test manual escalation endpoint
- [ ] Emails send on escalation (if configured)
- [ ] Socket.io real-time updates work
- [ ] SLA metrics endpoint returns correct data
- [ ] Analytics dashboard displays SLA compliance
- [ ] Can view SLA-breached complaints list
- [ ] Can view escalated complaints list
- [ ] Multiple escalation levels work correctly
- [ ] Resolved complaints don't escalate
- [ ] Max escalation level (3) enforced

---

## Success Criteria

✅ **System is production-ready when:**

1. All test cases pass
2. Scheduler runs reliably without errors
3. Email notifications working (if configured)
4. Dashboard displays accurate metrics
5. Real-time updates work smoothly
6. No memory leaks after extended testing
7. Performance acceptable (< 100ms response time)
8. Escalation logic handles edge cases

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure production MongoDB URI
- [ ] Set up production email service
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/SSL
- [ ] Set up monitoring & logging
- [ ] Test escalation workflow end-to-end
- [ ] Verify all email templates
- [ ] Test with realistic data volume
- [ ] Set up backup strategy
- [ ] Document escalation process for support team
- [ ] Create runbooks for common issues

---

## Quick Reference: Useful Commands

```bash
# Start backend with auto-restart on file changes
npm run dev

# Force run SLA scheduler
curl -X POST http://localhost:5000/api/admin/scheduler/force-run

# Get SLA definitions
curl http://localhost:5000/api/complaints/sla/definitions

# Get SLA metrics
curl http://localhost:5000/api/complaints/sla/metrics

# View SLA-breached complaints
curl http://localhost:5000/api/complaints/sla-breached

# View escalated complaints
curl http://localhost:5000/api/complaints/escalated

# Check server health
curl http://localhost:5000/api/health
```

---

## Need Help?

1. Check server logs for errors
2. Review MongoDB documents structure
3. Verify all env variables are set
4. Check browser console for frontend errors
5. Review email logs if email configured
6. Test with simplified data first (1-2 complaints)
