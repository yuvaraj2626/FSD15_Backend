# SLA System - Quick Start & Testing Guide

## Quick Start

### 1. System is Ready

The SLA system starts automatically when the server launches:

```bash
npm start
# You'll see:
# ✅ MongoDB Connected Successfully
# ⏰ SLA Scheduler initialized and started
```

✅ Scheduler is running and checking every 5 minutes

### 2. Test the System

Follow these step-by-step instructions to test all SLA features.

---

## Test Case 1: Create & Track Complaint

### Step 1: Create a Complaint

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database Connection Down",
    "description": "Cannot connect to the main database server",
    "category": "Technical",
    "priority": "Critical"
  }'
```

**Expected Response:**
```json
{
  "message": "Complaint created successfully",
  "complaint": {
    "_id": "COMPLAINT_ID",
    "title": "Database Connection Down",
    "priority": "Critical",
    "status": "OPEN",
    "slaDeadline": "2026-04-16T12:30:00.000Z",  // Current time + 2 hours
    "isEscalated": false,
    "escalationHistory": [],
    "createdAt": "2026-04-16T10:30:00.000Z"
  }
}
```

**✓ Check:** 
- SLA deadline is **2 hours** from creation (Critical = 2 hour SLA)

---

### Step 2: Check SLA Status

```bash
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Response:**
```json
{
  "message": "SLA status retrieved",
  "slaStatus": {
    "status": "On Track",
    "priority": "Critical",
    "slaHours": 2,
    "slaDeadline": "2026-04-16T12:30:00.000Z",
    "timeRemaining": {
      "hours": 1,
      "minutes": 59,
      "seconds": 45,
      "isOverdue": false,
      "timeRemaining": "1h 59m 45s"
    },
    "isEscalated": false,
    "escalatedAt": null,
    "escalationHistory": []
  }
}
```

**✓ Check:**
- Status: "On Track"
- isEscalated: false
- Time remaining shows hours, minutes, seconds

---

## Test Case 2: Priority Levels & SLA Times

Create complaints with different priorities and verify SLA deadlines.

### Critical Priority (2 hours)

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"System Down","description":"Test","category":"Technical","priority":"Critical"}'

# Created: 10:00:00
# Deadline: 12:00:00 (2 hours later) ✓
```

### High Priority (8 hours)

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Feature Broken","description":"Test","category":"Technical","priority":"High"}'

# Created: 10:00:00
# Deadline: 18:00:00 (8 hours later) ✓
```

### Medium Priority (24 hours)

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"UI Issue","description":"Test","category":"Technical","priority":"Medium"}'

# Created: 10:00:00
# Deadline: Next day 10:00:00 (24 hours later) ✓
```

### Low Priority (48 hours)

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Minor Bug","description":"Test","category":"Technical","priority":"Low"}'

# Created: 10:00:00
# Deadline: 2 days later at 10:00:00 (48 hours later) ✓
```

---

## Test Case 3: SLA Metrics Dashboard

### Get SLA Compliance Metrics (Admin Only)

```bash
curl -X GET http://localhost:5000/api/complaints/sla/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "message": "SLA metrics retrieved",
  "metrics": {
    "totalOpenComplaints": 10,
    "onTrack": 8,           // 80%
    "atRisk": 1,            // 10% (< 1 hour to deadline)
    "overdue": 0,           // 0%
    "escalated": 1,         // 10%
    "slaCompliance": "80.00%"
  }
}
```

**✓ Check:**
- Percentages add up to 100%
- Compliance percentage calculated correctly

---

## Test Case 4: Automatic Escalation

To test escalation without waiting 2+ hours, we'll manually set a past deadline.

### Step 1: Create a Complaint

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Test Escalation","description":"Will be escalated","category":"Technical","priority":"High"}'

# Save the COMPLAINT_ID
```

### Step 2: Manually Set Past Deadline (MongoDB)

Connect to MongoDB and update the complaint:

```javascript
// In MongoDB shell/Compass
db.complaints.updateOne(
  { _id: ObjectId("COMPLAINT_ID") },
  { 
    $set: { 
      slaDeadline: new Date(Date.now() - 60000)  // 1 minute in the past
    } 
  }
)
```

### Step 3: Wait for Scheduler (or force run)

The scheduler runs every 5 minutes. Or check the server code to force run.

**Server Logs Should Show:**
```
[SLA Scheduler] Running escalation check at 2026-04-16T10:05:00Z
[SLA Scheduler] ✓ Escalated 1 complaint(s)
  - ID: COMPLAINT_ID, Title: "Test Escalation", Priority: High → Critical
[SLA Scheduler] Check completed in 32ms
```

### Step 4: Verify Escalation

```bash
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Response:**
```json
{
  "slaStatus": {
    "status": "Escalated",
    "priority": "Critical",        // Priority increased!
    "slaHours": 2,                 // New SLA = 2 hours
    "isEscalated": true,
    "escalatedAt": "2026-04-16T10:05:00.000Z",
    "escalationHistory": [
      {
        "escalatedAt": "2026-04-16T10:05:00.000Z",
        "reason": "SLA_EXCEEDED",
        "previousPriority": "High",
        "newPriority": "Critical",
        "notes": "SLA Exceeded - High priority complaint exceeded 8-hour SLA by 1m 15s overdue",
        "escalatedBy": null           // null = auto-escalation
      }
    ]
  }
}
```

**✓ Check:**
- ✓ Status changed to "Escalated"
- ✓ Priority increased from High to Critical
- ✓ Escalation history recorded
- ✓ Escalated timestamp present

---

## Test Case 5: Status Workflow with Escalation

### Scenario: Support Works on Escalated Complaint

```bash
# 1. Create complaint (HIGH priority, 8-hour SLA)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Payment Issue","category":"Billing","priority":"High"}'

# 2. Admin assigns to support (as SUPPORT_USER_ID)
curl -X POST http://localhost:5000/api/complaints/COMPLAINT_ID/assign \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"supportUserId":"SUPPORT_USER_ID"}'
# Status: OPEN → ASSIGNED

# 3. Manually set past deadline (simulate SLA violation)
# [Use MongoDB to set slaDeadline to 1 hour ago]

# 4. Scheduler runs and escalates
# Status: ASSIGNED → ESCALATED
# Priority: High → Critical
# New deadline: 2 hours from escalation time

# 5. Support updates status
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"IN_PROGRESS"}'
# Status: ESCALATED → IN_PROGRESS ✓

# 6. Support resolves
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"RESOLVED"}'
# Status: IN_PROGRESS → RESOLVED ✓

# 7. Support closes
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"CLOSED"}'
# Status: RESOLVED → CLOSED ✓
```

**✓ Workflow Verification:**
- ✓ OPEN → ASSIGNED (admin action)
- ✓ ASSIGNED → ESCALATED (auto-escalation)
- ✓ ESCALATED → IN_PROGRESS (support action)
- ✓ IN_PROGRESS → RESOLVED (support action)
- ✓ RESOLVED → CLOSED (support action)

---

## Test Case 6: Resolved Complaints Don't Escalate

### Verify SLA Checks Skip Resolved Complaints

```bash
# 1. Create complaint with short SLA
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Quick Issue","category":"Technical","priority":"Critical"}'

# 2. Immediately resolve it
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"RESOLVED"}'

# 3. Set deadline to 1 hour ago (in MongoDB)
db.complaints.updateOne(
  { _id: ObjectId("COMPLAINT_ID") },
  { $set: { slaDeadline: new Date(Date.now() - 3600000) } }
)

# 4. Wait for scheduler or force run

# 5. Check SLA status
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Result:**
```json
{
  "slaStatus": {
    "status": "On Track",           // Not "Overdue"!
    "isEscalated": false,           // Not escalated
    "escalationHistory": []         // No escalation
  }
}
```

**✓ Check:**
- Resolved complaints are NOT marked as overdue
- Resolved complaints are NOT escalated
- SLA check correctly skips completed complaints

---

## Test Case 7: Admin SLA Compliance Dashboard

### Scenario: Mix of Complaints at Different Stages

```bash
# Create 5 complaints with different statuses
# 1. On track complaint (Critical, deadline 2 hours away)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Complaint 1","category":"Technical","priority":"Critical"}'

# 2. At risk complaint (High, deadline 30 min away)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Complaint 2","category":"Technical","priority":"High"}'
# [Manually set deadline to 30 min in future]

# 3. Overdue complaint (not yet auto-escalated)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Complaint 3","category":"Technical","priority":"Medium"}'
# [Manually set deadline to 1 hour ago]

# 4. Escalated complaint (already escalated)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Complaint 4","category":"Technical","priority":"Low"}'
# [Manually set deadline to 2 days ago to get it escalated, wait for scheduler]

# 5. Resolved complaint (not counted)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Complaint 5","category":"Technical","priority":"High"}'
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_5_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"RESOLVED"}'

# Check metrics
curl -X GET http://localhost:5000/api/complaints/sla/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Metrics:**
```json
{
  "metrics": {
    "totalOpenComplaints": 4,    // Not counting resolved
    "onTrack": 1,                 // Complaint 1
    "atRisk": 1,                  // Complaint 2
    "overdue": 1,                 // Complaint 3
    "escalated": 1,               // Complaint 4
    "slaCompliance": "25.00%"     // 1/4 on track
  }
}
```

---

## Test Case 8: Escalation History Details

### Verify Full Escalation Record

```bash
# After escalation, get SLA status
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Full Escalation History Example:**
```json
{
  "escalationHistory": [
    {
      "escalatedAt": "2026-04-16T10:05:32.123Z",
      "reason": "SLA_EXCEEDED",
      "previousPriority": "High",
      "newPriority": "Critical",
      "escalatedBy": null,
      "notes": "SLA Exceeded - High priority complaint exceeded 8-hour SLA by 5 minutes overdue",
      "_id": "507f..."
    },
    {
      "escalatedAt": "2026-04-16T12:30:15.456Z",
      "reason": "SLA_EXCEEDED",
      "previousPriority": "Critical",
      "newPriority": "Critical",
      "escalatedBy": null,
      "notes": "SLA Exceeded - Critical priority complaint exceeded 2-hour SLA by 10 minutes overdue",
      "_id": "507f..."
    }
  ]
}
```

**✓ Check:**
- Timestamps accurate
- Priority changes recorded
- Reason properly set to SLA_EXCEEDED
- Notes contain detailed information
- escalatedBy is null (auto-escalation)

---

## Test Case 9: Invalid Status Transitions

### Verify Workflow Validation

```bash
# Create a complaint
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Test","category":"Technical","priority":"High"}'

# Try invalid transition: OPEN → CLOSED (should skip intermediate statuses)
# This is actually VALID (can skip to final state)
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"CLOSED"}'
# ✓ Valid

# Try truly invalid: OPEN → RESOLVED (skipping some states is ok)
# Hmm, actually this is also valid. Let me show a real invalid:

# Get to RESOLVED state
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"RESOLVED"}'

# Try to go backwards: RESOLVED → IN_PROGRESS (INVALID)
curl -X PUT http://localhost:5000/api/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  -d '{"status":"IN_PROGRESS"}'

# Expected Error:
```

**Expected Error Response:**
```json
{
  "message": "Invalid status transition from RESOLVED to IN_PROGRESS"
}
```

**✓ Check:**
- Cannot transition backwards in workflow
- Cannot transition to non-existent statuses
- Error message is clear

---

## Test Case 10: Time Remaining Accuracy

### Monitor Countdown to Deadline

```bash
# Create complaint
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"title":"Deadline Test","category":"Technical","priority":"Critical"}'

# Check SLA status multiple times
for i in {1..5}; do
  echo "Check $i:"
  curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
    -H "Authorization: Bearer YOUR_USER_TOKEN" | jq '.slaStatus.timeRemaining'
  sleep 10
done
```

**Expected Output (counting down):**
```
Check 1: { "hours": 1, "minutes": 59, "seconds": 50, "isOverdue": false, "timeRemaining": "1h 59m 50s" }
Check 2: { "hours": 1, "minutes": 59, "seconds": 40, "isOverdue": false, "timeRemaining": "1h 59m 40s" }
Check 3: { "hours": 1, "minutes": 59, "seconds": 30, "isOverdue": false, "timeRemaining": "1h 59m 30s" }
...
```

**✓ Check:**
- Time remaining decreases over time
- Format is consistent
- Calculation is accurate

---

## Monitoring & Debugging

### Check Server Logs

```bash
# Look for scheduler logs (every 5 minutes)
npm start 2>&1 | grep "SLA Scheduler"
```

**Expected Output:**
```
[SLA Scheduler] Starting SLA checker (interval: 5 minutes)
[SLA Scheduler] Running escalation check at 2026-04-16T10:00:00Z
[SLA Scheduler] ✓ No complaints exceeding SLA
[SLA Scheduler] Check completed in 23ms
```

### Check Database State

```javascript
// MongoDB shell

// See all complaints with SLA info
db.complaints.find({}, {
  _id: 1,
  title: 1,
  priority: 1,
  status: 1,
  slaDeadline: 1,
  isEscalated: 1,
  escalatedAt: 1
}).pretty()

// Find escalated complaints
db.complaints.find({ isEscalated: true }).pretty()

// Count by status
db.complaints.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Complaints near deadline (within 1 hour)
db.complaints.find({
  status: { $nin: ["RESOLVED", "CLOSED"] },
  slaDeadline: { 
    $gte: new Date(),
    $lte: new Date(Date.now() + 60*60*1000)
  }
})
```

---

## Common Issues & Solutions

### Issue: Escalations Not Happening

**Check:**
1. Server logs show `[SLA Scheduler]` messages
2. Database has past deadlines: 
   ```javascript
   db.complaints.find({ slaDeadline: { $lt: new Date() } }).count()
   ```
3. Complaints are not RESOLVED/CLOSED:
   ```javascript
   db.complaints.find({ 
     slaDeadline: { $lt: new Date() },
     status: { $nin: ["RESOLVED", "CLOSED"] }
   }).count()
   ```

### Issue: Time Remaining Shows Negative

**Solution:** Refresh page or wait for next scheduler check

### Issue: SLA Deadline in Past on Creation

**Check:** System timezone is correct and datetime is accurate

---

## Summary of Tests

✅ **Test Case 1:** Create complaint & verify SLA deadline calculated  
✅ **Test Case 2:** Verify all priority levels have correct SLA times  
✅ **Test Case 3:** Get admin dashboard metrics  
✅ **Test Case 4:** Simulate and verify auto-escalation  
✅ **Test Case 5:** Verify full workflow with escalation  
✅ **Test Case 6:** Verify resolved complaints don't escalate  
✅ **Test Case 7:** Mix of complaint stages and metrics  
✅ **Test Case 8:** Verify detailed escalation history  
✅ **Test Case 9:** Verify status transition validation  
✅ **Test Case 10:** Monitor countdown to deadline  

---

**All tests passing? System is working correctly! 🎉**
