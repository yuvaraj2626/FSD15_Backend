# SLA System - Quick Start Guide

> ⚡ **Get up and running in 5 minutes**

---

## 📋 Prerequisites

✅ Node.js 14+  
✅ MongoDB running (local or Atlas)  
✅ npm/yarn installed  
✅ Text editor for .env file  

---

## 🚀 5-Minute Setup

### Step 1: Configure Environment (1 min)

```bash
# Copy template
cp .env.example server/.env

# Edit with your values
nano server/.env  # or vi, code, etc.
```

**Minimum required in .env:**
```env
MONGODB_URI=mongodb://localhost:27017/complaints_db
JWT_SECRET=dev-secret-key
PORT=5000
NODE_ENV=development
SLA_CHECK_INTERVAL_MS=300000
```

### Step 2: Install Dependencies (2 min)

```bash
# Backend
cd server
npm install

# Frontend (in another terminal)
cd client
npm install
```

### Step 3: Start Services (1 min)

```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Frontend
cd client
npm start

# Terminal 3: Monitor (optional)
tail -f server/logs.txt
```

### Step 4: Verify Installation (1 min)

```bash
# Test API health
curl http://localhost:5000/api/health

# Open frontend
open http://localhost:3000

# See scheduler running (check backend console for):
# [SLA Scheduler] ✅ Started with node-cron (every 5 min)
```

---

## ✨ What You Now Have

✅ **Auto-SLA System**  
- Every complaint gets automatic SLA deadline based on priority  
- Low = 48h, Medium = 24h, High = 6h, Critical = 2h  

✅ **Auto-Escalation**  
- Background scheduler checks every 5 minutes  
- Auto-escalates breached complaints  
- Bumps priority and reassigns to senior staff  

✅ **Real-Time Dashboard**  
- See live SLA countdown on each complaint  
- Color indicators: Green (on track) → Red (breached)  
- Escalation badges show level  

✅ **Admin Controls**  
- Manual escalation endpoint  
- View SLA metrics dashboard  
- See breached complaints list  

---

## 🧪 Quick Test

### 1. Create a Complaint

```bash
# Get a USER token first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Copy the token from response
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Create complaint
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "System is down",
    "description": "Critical failure",
    "category": "Technical",
    "priority": "Critical"
  }'

# Response will show:
# "slaDeadline": "2026-04-24T14:30:00Z"  (now + 2 hours)
# "isEscalated": false
```

### 2. View SLA Status

```bash
# Replace COMPLAINT_ID with ID from above
curl -X GET http://localhost:5000/api/complaints/COMPLAINT_ID/sla-status \
  -H "Authorization: Bearer $TOKEN"

# See countdown: "1h 45m 32s remaining"
```

### 3. View Dashboard

```
http://localhost:3000/dashboard

# You'll see:
# - Complaint cards with live SLA timer
# - Color-coded by urgency
# - Click to see full details
```

---

## 📊 SLA Definitions

| Priority | SLA | Example |
|----------|-----|---------|
| 🟢 Low | 48 hours | Feature request |
| 🟡 Medium | 24 hours | Billing issue |
| 🟠 High | 6 hours | Service degradation |
| 🔴 Critical | 2 hours | System down |

---

## 🔧 What to Configure

### Email Notifications (Optional)

To send escalation alerts:

```env
# Gmail example:
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=noreply@system.local

# For other providers (SendGrid, Mailgun, etc.):
# Check emailService.js for configuration
```

### Scheduler Frequency (Optional)

Change how often system checks for breaches:

```env
# Every 1 minute (testing):
SLA_CHECK_INTERVAL_MS=60000

# Every 5 minutes (default):
SLA_CHECK_INTERVAL_MS=300000

# Every 15 minutes (production):
SLA_CHECK_INTERVAL_MS=900000
```

---

## 📁 Key Files to Know

```
server/
  utils/slaHelper.js          ← All SLA logic
  scheduler/slaScheduler.js   ← Background job
  routes/complaints.js         ← API endpoints
  models/Complaint.js          ← Database schema

client/
  components/SLATimer.js       ← Countdown display
  components/ComplaintList.js  ← Integration
```

---

## 🆘 Troubleshooting

**Q: Scheduler not running?**  
A: Check console for `[SLA Scheduler]` logs. Verify MongoDB connected.

**Q: Escalations not happening?**  
A: Reduce `SLA_CHECK_INTERVAL_MS` to 10000 for testing. Wait 10-15 seconds.

**Q: Emails not sending?**  
A: Check EMAIL_* vars in .env. See `emailService.js` for setup.

**Q: Port 5000 in use?**  
A: Change PORT in .env to 5001 or kill existing process.

---

## 📚 Full Documentation

For complete details, see:

- `SLA_COMPLETE_IMPLEMENTATION.md` - Full overview
- `SLA_END_TO_END_TESTING_GUIDE.md` - Test procedures
- `SLA_DOCUMENTATION.md` - Technical reference
- `.env.example` - All configuration options

---

## ✅ Success!

When you see this in console:

```
✅ MongoDB Connected Successfully
⏰ SLA Scheduler initialized (interval: 5.0 min)
[SLA Scheduler] ✅ Started with node-cron (every 5 min)
🚀 Server running on port 5000
```

**Your SLA system is live and ready! 🎉**

---

## 🎯 Next Steps

1. ✅ Create test complaints with different priorities
2. ✅ View live SLA countdown on dashboard
3. ✅ Test manual escalation (Admin only)
4. ✅ Configure email notifications
5. ✅ Run full test suite (see testing guide)
6. ✅ Deploy to production

---

## 💡 Pro Tips

- **Speed up testing**: Set `SLA_CHECK_INTERVAL_MS=10000` (10 seconds)
- **Test escalations**: Modify `slaDeadline` in MongoDB to past time
- **Monitor logs**: `tail -f server/logs.txt | grep SLA`
- **Check scheduler**: `curl http://localhost:5000/api/health`

---

**You're all set! 🚀 Start creating complaints and watch the SLA magic happen.**
