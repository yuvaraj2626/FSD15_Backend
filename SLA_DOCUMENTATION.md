# SLA & Escalation System Documentation

## Overview

The SLA (Service Level Agreement) and escalation system automatically ensures that complaints are resolved within defined timeframes based on priority level. When a complaint exceeds its SLA deadline, it is automatically escalated with increased priority and marked with the ESCALATED status.

---

## Architecture

### Components

1. **Model Layer** (`server/models/Complaint.js`)
   - Extends Complaint schema with SLA fields
   - Stores deadline, escalation status, and escalation history

2. **Utility Layer** (`server/utils/slaHelper.js`)
   - Core SLA calculations and business logic
   - 10+ utility functions for SLA management

3. **Scheduler** (`server/scheduler/slaScheduler.js`)
   - Background job runner using `setInterval`
   - Checks for SLA violations every 5 minutes
   - Persists scheduler state and statistics

4. **API Routes** (`server/routes/complaints.js`)
   - Endpoints to check SLA status
   - Metrics dashboard for administrators

5. **Server Integration** (`server/server.js`)
   - Initializes scheduler on MongoDB connection
   - Logs scheduler status during startup

---

## Data Model

### Complaint Schema Extensions

```javascript
{
  // ... existing fields ...
  
  // SLA Fields
  slaDeadline: Date,              // Calculated deadline based on priority
  isEscalated: Boolean,           // Flag for escalated status
  escalatedAt: Date,              // When auto-escalation occurred
  
  // Escalation History
  escalationHistory: [{
    escalatedAt: Date,
    reason: String,               // 'SLA_EXCEEDED' or 'MANUAL'
    previousPriority: String,     // Priority before escalation
    newPriority: String,          // Priority after escalation
    escalatedBy: ObjectId,        // User who escalated (null for auto)
    notes: String                 // Escalation reason details
  }]
}
```

### Status Workflow

The complaint status workflow now includes ESCALATED status:

```
OPEN 
  ├─→ ASSIGNED (via admin assignment)
  ├─→ ESCALATED (via SLA violation)
  ├─→ IN_PROGRESS (via support update)
  ├─→ RESOLVED (via support update)
  └─→ CLOSED (final state)

ASSIGNED
  ├─→ ESCALATED (via SLA violation)
  ├─→ IN_PROGRESS
  ├─→ RESOLVED
  └─→ CLOSED

ESCALATED
  ├─→ IN_PROGRESS
  ├─→ RESOLVED
  └─→ CLOSED
```

---

## SLA Definitions

### Priority-Based SLA Times

| Priority | Hours | Duration | Use Case |
|----------|-------|----------|----------|
| Critical | 2 | 2 hours | System outages, security issues |
| High | 8 | 8 hours | Major functionality broken |
| Medium | 24 | 24 hours | Non-critical issues |
| Low | 48 | 48 hours | Minor issues, feature requests |

### SLA Constants

Located in `server/utils/slaHelper.js`:

```javascript
const SLA_DEFINITIONS = {
    Critical: { hours: 2 },
    High: { hours: 8 },
    Medium: { hours: 24 },
    Low: { hours: 48 }
};
```

---

## Core Functions

### `calculateSLADeadline(priority, createdAt)`

Calculates the SLA deadline based on priority and creation time.

**Parameters:**
- `priority` (String) - Priority level (Critical, High, Medium, Low)
- `createdAt` (Date) - Complaint creation timestamp

**Returns:** Date object representing the SLA deadline

**Example:**
```javascript
const deadline = calculateSLADeadline('High', new Date());
// If created at 2026-04-16 10:00:00
// Deadline will be 2026-04-16 18:00:00 (8 hours later)
```

### `isOverSLA(complaint)`

Checks if a complaint has exceeded its SLA deadline.

**Parameters:**
- `complaint` (Object) - Complaint document

**Returns:** Boolean

**Logic:**
- Returns `false` if status is RESOLVED or CLOSED
- Returns `true` if current time > slaDeadline
- Otherwise returns `false`

### `getTimeUntilSLADeadline(complaint)`

Calculates remaining time until SLA deadline or overdue duration.

**Returns:** Object
```javascript
{
  hours: Number,
  minutes: Number,
  seconds: Number,
  isOverdue: Boolean,
  timeRemaining: String,        // "2h 30m 45s"
  overdueDuration: String       // "1h 15m overdue"
}
```

### `checkAndEscalateDueComplaints()`

Main escalation check function. Finds all complaints exceeding SLA and escalates them.

**Called by:** SLA Scheduler every 5 minutes

**Process:**
1. Query for non-resolved complaints with slaDeadline < now
2. For each complaint, call `escalateComplaint()`
3. Collect results and logging

**Returns:**
```javascript
{
  escalatedCount: Number,
  details: [
    {
      complaintId: String,
      title: String,
      priority: String,
      newPriority: String,
      assignedTo: Object,
      overdueBy: String
    }
  ],
  timestamp: Date
}
```

### `escalateComplaint(complaintId, options)`

Escalates a single complaint by:
- Setting `isEscalated = true` and `escalatedAt = now`
- Adding escalation record to history
- Increasing priority (Low→Medium, Medium→High, High→Critical)
- Recalculating SLA deadline with new priority

**Parameters:**
- `complaintId` (String) - Complaint ID
- `options` (Object) - { reason, escalatedBy, notes }

**Example:**
```javascript
const escalated = await escalateComplaint(complaintId, {
  reason: 'SLA_EXCEEDED',
  notes: 'Critical priority complaint exceeded 2-hour SLA by 30 minutes'
});
```

### `getSLAStatus(complaint)`

Returns comprehensive SLA status information for a complaint.

**Returns:**
```javascript
{
  status: String,               // "On Track", "Overdue", "Escalated", etc.
  priority: String,
  slaHours: Number,
  slaDeadline: Date,
  timeRemaining: Object,        // From getTimeUntilSLADeadline()
  isEscalated: Boolean,
  escalatedAt: Date,
  escalationHistory: Array
}
```

### `getSLAMetrics()`

Retrieves system-wide SLA compliance metrics (admin dashboard).

**Returns:**
```javascript
{
  totalOpenComplaints: Number,
  onTrack: Number,              // Within SLA
  atRisk: Number,               // Within 1 hour of deadline
  overdue: Number,              // Past SLA but not auto-escalated
  escalated: Number,            // Already escalated
  slaCompliance: String         // "85.50%"
}
```

### `updateSLADeadlineForPriorityChange(complaint, newPriority)`

Updates SLA deadline when complaint priority is manually changed.

**Returns:**
```javascript
{
  oldDeadline: Date,
  newDeadline: Date,
  priorityChanged: Boolean
}
```

---

## Scheduler

### Initialization

The scheduler is initialized in `server/server.js`:

```javascript
const { initializeScheduler } = require('./scheduler/slaScheduler');

// After MongoDB connection
const slaScheduler = initializeScheduler(5 * 60 * 1000); // 5 minutes
slaScheduler.start();
```

### Configuration

**Interval:** Every 5 minutes (300,000 milliseconds)

Can be adjusted in `server/server.js`:
```javascript
initializeScheduler(1 * 60 * 1000);  // 1 minute
initializeScheduler(10 * 60 * 1000); // 10 minutes
```

### Scheduler Methods

#### `start()`
Starts the scheduler and runs first check immediately.

#### `stop()`
Stops the scheduler interval.

#### `status()`
Returns current scheduler status:
```javascript
{
  isRunning: Boolean,
  intervalMs: Number,
  interval: String,             // "5.0 minutes"
  lastRun: Date,
  nextRun: Date,
  totalRuns: Number,
  totalEscalations: Number,
  recentErrors: Array
}
```

#### `forceRun()`
Manually trigger an escalation check (useful for testing).

### Log Output

When the scheduler runs:

```
[SLA Scheduler] Running escalation check at 2026-04-16T10:00:00Z
[SLA Scheduler] ✓ Escalated 2 complaint(s)
  - ID: 507f..., Title: "Database Down", Medium → High, Overdue: 2h 30m
  - ID: 507f..., Title: "Payment Failed", Low → Medium, Overdue: 1d 4h
[SLA Scheduler] Check completed in 47ms
```

---

## API Endpoints

### Get SLA Status for Complaint

```bash
GET /api/complaints/{complaintId}/sla-status
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "SLA status retrieved",
  "slaStatus": {
    "status": "Overdue",
    "priority": "High",
    "slaHours": 8,
    "slaDeadline": "2026-04-16T18:00:00Z",
    "timeRemaining": {
      "hours": 0,
      "minutes": 0,
      "seconds": 0,
      "isOverdue": true,
      "overdueDuration": "2h 15m overdue"
    },
    "isEscalated": true,
    "escalatedAt": "2026-04-16T15:30:00Z",
    "escalationHistory": [...]
  }
}
```

### Get SLA Metrics (Admin)

```bash
GET /api/complaints/sla/metrics
Authorization: Bearer <ADMIN_TOKEN>
```

**Response:**
```json
{
  "message": "SLA metrics retrieved",
  "metrics": {
    "totalOpenComplaints": 25,
    "onTrack": 20,
    "atRisk": 3,
    "overdue": 1,
    "escalated": 1,
    "slaCompliance": "80.00%"
  }
}
```

---

## Workflow Example

### Scenario: Support Team Misses SLA

**10:00 AM** - User creates "Payment Processing Down" complaint
- Priority: **Critical** (2-hour SLA)
- SLA Deadline: **12:00 PM**
- Status: **OPEN**

**10:30 AM** - Admin assigns to support agent
- Status: **ASSIGNED**
- Deadline: Still 12:00 PM

**11:00 AM** - Support starts investigating
- Status: **IN_PROGRESS**
- Deadline: Still 12:00 PM

**11:55 AM** - Scheduler runs (first check before deadline)
- Complaint is OPEN with deadline at 12:00 PM
- Status: ✓ Still within SLA

**12:00 PM** - SLA deadline passes
- Support agent still investigating
- Status: **IN_PROGRESS**
- SLA deadline has passed

**12:05 PM** - Scheduler runs
- Finds complaint exceeding SLA
- Status changes to: **ESCALATED**
- Priority: **Critical → Critical** (already max)
- **Escalation recorded** in history
- Support agent **receives notification**

**1:00 PM** - Support resolves issue
- Status: **RESOLVED**
- Escalation complete
- SLA check: ✓ Skipped (no longer active complaint)

**1:30 PM** - Support closes complaint
- Status: **CLOSED**
- Final state

### Escalation History

```javascript
escalationHistory: [
  {
    escalatedAt: "2026-04-16T12:05:00Z",
    reason: "SLA_EXCEEDED",
    previousPriority: "Critical",
    newPriority: "Critical",  // Already at max
    escalatedBy: null,        // Auto-escalation
    notes: "SLA Exceeded - Critical priority complaint exceeded 2-hour SLA by 5 minutes"
  }
]
```

---

## Integration Points

### 1. Creating Complaints

When a complaint is created via `POST /api/complaints`:

```javascript
const priorityLevel = priority || 'Medium';
const now = new Date();

const complaint = new Complaint({
  // ... other fields ...
  priority: priorityLevel,
  slaDeadline: calculateSLADeadline(priorityLevel, now),  // ← Auto-calculated
  isEscalated: false,
  escalationHistory: []
});
```

### 2. Status Transitions

Status transitions now include ESCALATED:

```javascript
const isValidStatusTransition = (currentStatus, newStatus) => {
  const transitions = {
    'OPEN': ['ASSIGNED', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    'ASSIGNED': ['ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    'ESCALATED': ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    // ...
  };
  return transitions[currentStatus]?.includes(newStatus) || false;
};
```

### 3. Priority Changes

When priority is manually updated:

```javascript
if (newPriority !== complaint.priority) {
  updateSLADeadlineForPriorityChange(complaint, newPriority);
  // SLA deadline recalculated based on new priority
}
```

### 4. Real-time Notifications

When a complaint is escalated, Socket.io notifies the assigned support agent:

```javascript
io.to(`user:${complaint.assignedTo}`).emit('complaintEscalated', {
  complaintId: complaint._id,
  title: complaint.title,
  priority: complaint.priority,
  escalatedAt: complaint.escalatedAt
});
```

---

## Error Handling

### Scheduler Errors

Errors during escalation checks are caught and logged:

```javascript
[SLA Scheduler] Error during escalation check: ECONNREFUSED
[SLA Scheduler] - Previous error: ETIMEDOUT at 2026-04-16T10:00:00Z
[SLA Scheduler] - Previous error: ECONNREFUSED at 2026-04-16T09:55:00Z
```

**Last 10 errors** are kept in memory for debugging.

### API Errors

- **404** - Complaint not found
- **403** - Access denied (role check)
- **500** - Server error during SLA check

---

## Best Practices

### 1. SLA Time Configuration

Choose realistic SLA times for your business:

```javascript
// For urgent support
Critical: 1 hour
High: 4 hours

// For standard support
Critical: 2 hours
High: 8 hours
Medium: 24 hours
Low: 48 hours
```

### 2. Monitoring Scheduler Health

Regularly check scheduler status:

```bash
# In production monitoring
GET /api/complaints/sla/metrics  # Monitor compliance
# Check server logs for [SLA Scheduler] entries
```

### 3. Handling Escalations

When a complaint is escalated:
- Alert the assigned support agent immediately
- Consider automatically assigning to a senior agent
- Add notification to admin dashboard
- Track escalation metrics for team performance

### 4. Priority Management

Guidelines for setting priorities:

- **Critical**: System down, security breach, major data loss
- **High**: Key feature broken, revenue impact, customer retention risk
- **Medium**: Normal business operations affected, workaround available
- **Low**: Minor issues, feature requests, documentation problems

### 5. Database Indexing

For performance, add indexes:

```javascript
// In Complaint model
complaintSchema.index({ slaDeadline: 1, status: 1, isEscalated: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
```

---

## Testing

### Manual Testing

1. **Create a test complaint with Critical priority**
   ```bash
   curl -X POST http://localhost:5000/api/complaints \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"title":"Test","description":"Test","category":"Technical","priority":"Critical"}'
   ```

2. **Check SLA status**
   ```bash
   curl -X GET http://localhost:5000/api/complaints/{id}/sla-status \
     -H "Authorization: Bearer <TOKEN>"
   ```

3. **Force scheduler to run** (in code)
   ```javascript
   const scheduler = initializeScheduler();
   scheduler.start();
   await scheduler.forceRun();  // Manually trigger escalation
   ```

4. **Wait 2+ hours or modify test data**
   - Manually set `slaDeadline` to past date in MongoDB
   - Run scheduler
   - Verify escalation occurred

### Automated Testing

Create test cases for:

```javascript
describe('SLA System', () => {
  test('calculateSLADeadline should add correct hours', () => {
    const now = new Date();
    const deadline = calculateSLADeadline('Critical', now);
    expect(deadline.getHours()).toBe(now.getHours() + 2);
  });

  test('checkAndEscalateDueComplaints should escalate overdue complaints', async () => {
    // Create complaint with past deadline
    // Run escalation check
    // Assert isEscalated = true
  });

  test('getSLAMetrics should calculate compliance correctly', async () => {
    // Create mix of on-track and overdue complaints
    // Calculate metrics
    // Assert compliance percentage
  });
});
```

---

## Deployment Considerations

### Environment Variables

No additional environment variables needed, but can add:

```env
SLA_CHECK_INTERVAL=300000  # milliseconds
SLA_ENABLE_SCHEDULER=true
```

### Database Requirements

- Indexes on `slaDeadline`, `status`, `isEscalated`
- Compound index: `{ status: 1, slaDeadline: 1 }`
- For large datasets, partition escalation history

### Scaling

For high-volume systems:

1. **Cluster-aware scheduler**
   - Add a `schedulerLeader` flag
   - Only one scheduler instance per cluster

2. **Batch processing**
   - Process escalations in batches of 100
   - Prevents database strain

3. **Caching**
   - Cache SLA_DEFINITIONS
   - Cache metrics for 1 minute

---

## Troubleshooting

### Escalations Not Happening

**Check:**
1. Is scheduler running? Check server logs for `[SLA Scheduler]`
2. Are complaints past deadline? Check `slaDeadline` in database
3. Are complaints RESOLVED/CLOSED? SLA checks skip completed complaints
4. Database connection? Check for connection errors

### Scheduler Consuming Too Many Resources

**Solutions:**
1. Increase interval: `initializeScheduler(10 * 60 * 1000)`
2. Add indexes on `{ slaDeadline: 1, status: 1 }`
3. Archive old escalation histories

### Incorrect SLA Calculations

**Verify:**
1. SLA_DEFINITIONS values are correct
2. Complaint creation timestamp is accurate
3. Timezone handling (uses UTC)
4. No DST issues

---

## Future Enhancements

1. **Business Hours SLA**
   - Only count business hours toward SLA
   - Skip weekends/holidays

2. **Escalation Policies**
   - Route escalations to senior agents
   - Auto-notify managers

3. **SLA Reports**
   - Daily/weekly escalation reports
   - Team SLA compliance metrics

4. **Custom SLA Rules**
   - Per-category SLA times
   - VIP customer prioritization
   - Seasonal adjustments

5. **Pause/Resume**
   - Pause SLA clock for customer delays
   - Resume when customer responds

---

**For questions or issues, refer to README.md or contact the development team.**
