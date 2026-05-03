# SLA System - Quick Reference Card

## 📋 Files Overview

### Core Implementation Files

| File | Lines | Purpose |
|------|-------|---------|
| `server/utils/slaHelper.js` | 330 | SLA calculations, escalation logic |
| `server/scheduler/slaScheduler.js` | 200 | Background job scheduler (runs every 5 min) |
| `server/models/Complaint.js` | Updated | Added slaDeadline, escalationHistory fields |
| `server/routes/complaints.js` | Updated | New SLA endpoints, workflow with ESCALATED |
| `server/server.js` | Updated | Scheduler initialization on startup |

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Updated with SLA feature overview |
| `SLA_DOCUMENTATION.md` | Complete developer reference |
| `SLA_IMPLEMENTATION_SUMMARY.md` | Implementation overview |
| `SLA_TESTING_GUIDE.md` | 10 test cases with curl examples |

---

## 🚀 Key Components at a Glance

### 1. SLA Definitions
```javascript
// Priority → Hours to resolve
Critical: 2 hours
High:     8 hours
Medium:   24 hours
Low:      48 hours
```

### 2. Status Workflow
```
OPEN → ASSIGNED → ESCALATED → IN_PROGRESS → RESOLVED → CLOSED
                        ↑
                   Auto-set when
                   SLA exceeded
```

### 3. Complaint Model Fields
```javascript
slaDeadline:       Date
isEscalated:       Boolean
escalatedAt:       Date
escalationHistory: Array
```

### 4. API Endpoints
```
POST   /api/complaints               → Calculate SLA deadline
GET    /api/complaints/:id/sla-status
GET    /api/complaints/sla/metrics   (admin only)
```

---

## ⚙️ How the Scheduler Works

```
Server Start
    ↓
MongoDB Connected
    ↓
Initialize Scheduler (5 min interval)
    ↓
Scheduler Runs Every 5 Minutes
    ↓
Query: Find complaints where:
  - status ≠ RESOLVED, CLOSED
  - slaDeadline < now
  - isEscalated = false
    ↓
For Each Overdue Complaint:
  1. Set isEscalated = true
  2. Set escalatedAt = now
  3. Increase priority (Low→Medium, etc)
  4. Recalculate deadline with new priority
  5. Record in escalationHistory
  6. Send Socket.io notification
    ↓
Log Results to Console
```

---

## 📝 Code Examples

### Create a Complaint (SLA Auto-Calculated)
```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Issue","category":"Technical","priority":"High"}'

# Returns complaint with:
# slaDeadline: "2026-04-16T18:00:00Z" (8 hours from now)
# isEscalated: false
# escalationHistory: []
```

### Get SLA Status
```bash
curl -X GET http://localhost:5000/api/complaints/{id}/sla-status \
  -H "Authorization: Bearer TOKEN"

# Returns:
# {
#   "status": "On Track",
#   "timeRemaining": "7h 45m 30s",
#   "isEscalated": false,
#   "escalationHistory": []
# }
```

### Check Compliance Metrics (Admin)
```bash
curl -X GET http://localhost:5000/api/complaints/sla/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Returns:
# {
#   "totalOpenComplaints": 25,
#   "onTrack": 20,
#   "atRisk": 3,
#   "overdue": 1,
#   "escalated": 1,
#   "slaCompliance": "80.00%"
# }
```

---

## 🧪 Quick Test

### 1. Create Complaint
```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{"title":"Test","category":"Technical","priority":"Critical"}'
```

### 2. Get Complaint ID from response
```
"_id": "COMPLAINT_ID"
```

### 3. Check SLA Status
```bash
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer USER_TOKEN"
```

### 4. View Server Logs
Should see:
```
[SLA Scheduler] Starting SLA checker (interval: 5 minutes)
[SLA Scheduler] Running escalation check at 2026-04-16T10:00:00Z
[SLA Scheduler] ✓ No complaints exceeding SLA
[SLA Scheduler] Check completed in 23ms
```

---

## 🔍 Debugging

### Check if Scheduler is Running
```javascript
// In server logs, look for:
⏰ SLA Scheduler initialized and started

// Should also see every 5 minutes:
[SLA Scheduler] Running escalation check at ...
```

### Check Database State
```javascript
// MongoDB - See all complaints with SLA info
db.complaints.find({
  slaDeadline: 1,
  isEscalated: 1,
  escalatedAt: 1,
  status: 1
})

// See escalated complaints
db.complaints.find({ isEscalated: true })
```

### Force Escalation Check (Development)
```javascript
// In Node REPL, add to slaScheduler.js exports:
module.exports.forceRun = () => runEscalationCheck(scheduler);

// Then call:
const scheduler = require('./scheduler/slaScheduler');
await scheduler.forceRun();
```

---

## 📊 SLA Compliance Calculation

```
On Track = Complaints within SLA deadline
Compliance % = (On Track / Total Open) × 100

Example:
  Total: 25 complaints
  On Track: 20
  Compliance: (20/25) × 100 = 80%
```

---

## 🔄 Escalation Example Timeline

```
10:00 AM - Create complaint (High priority, 8-hour SLA)
           SLA Deadline: 6:00 PM

10:05 AM - Scheduler runs: No escalation needed ✓

...

6:00 PM  - SLA deadline reached

6:05 PM  - Scheduler runs:
           Complaint exceeds SLA deadline!
           Escalate: High → Critical
           New deadline: 6:05 PM + 2 hours = 8:05 PM
           Record escalation in history ✓

6:30 PM  - Support agent updates status to IN_PROGRESS
           (escalation complete, work continues)

8:00 PM  - Support agent resolves the issue
           Status: RESOLVED
           (SLA checks no longer run for resolved)

...

8:30 PM - Scheduler skips this complaint
          (Status = RESOLVED)
```

---

## 🎯 Workflow Status Transitions

### Valid Transitions
```
OPEN         → Any status
ASSIGNED     → ESCALATED, IN_PROGRESS, RESOLVED, CLOSED
ESCALATED    → IN_PROGRESS, RESOLVED, CLOSED
IN_PROGRESS  → RESOLVED, CLOSED
RESOLVED     → CLOSED
CLOSED       → (final state)
```

### Invalid Transitions (Blocked)
```
RESOLVED → IN_PROGRESS  ❌ Cannot go backwards
CLOSED → ASSIGNED       ❌ Cannot go backwards
ANY → OPEN              ❌ Cannot return to OPEN
```

---

## 💾 Database Indexes (Recommended)

```javascript
// Add to Complaint model for performance
complaintSchema.index({ slaDeadline: 1, status: 1, isEscalated: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
```

---

## 🚨 Common Issues & Quick Fixes

| Issue | Check | Fix |
|-------|-------|-----|
| Escalations not happening | Server logs for `[SLA Scheduler]` | Restart server, check MongoDB |
| Wrong time calculations | System timezone | Ensure UTC timezone |
| Metrics not updating | Refresh page, wait 5 min | Scheduler runs every 5 minutes |
| Can't get SLA status | User has access? | Check Authorization header |

---

## 📚 Documentation Map

- **Getting Started**: README.md
- **API Reference**: README.md (API Endpoints section)
- **Developer Guide**: SLA_DOCUMENTATION.md
- **Testing**: SLA_TESTING_GUIDE.md
- **Implementation Details**: SLA_IMPLEMENTATION_SUMMARY.md

---

## ✅ Verification Checklist

- [x] Scheduler initializes on server start
- [x] Complaints get SLA deadline on creation
- [x] Scheduler runs every 5 minutes
- [x] Escalation records are created
- [x] Priority increases on escalation
- [x] New deadline calculated after escalation
- [x] Escalation history stored
- [x] API endpoints functional
- [x] Resolved/Closed complaints skip SLA
- [x] Compliance metrics accurate
- [x] Logging comprehensive
- [x] Documentation complete

**All checks passing? System is ready for production! 🎉**

---

## 📞 Support

For detailed information, see:
- **Technical Questions**: SLA_DOCUMENTATION.md
- **How to Test**: SLA_TESTING_GUIDE.md
- **Implementation Details**: SLA_IMPLEMENTATION_SUMMARY.md
- **User Features**: README.md
