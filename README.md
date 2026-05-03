# 📋 Complaint Management System

A professional, full-stack complaint management system built with the **MERN Stack** (MongoDB, Express, React, Node.js). This application provides a comprehensive platform for users to submit complaints, track their status in real-time, and enable support teams to efficiently manage and resolve issues.

---

## ✨ Features

### 👤 User Features
- **User Authentication** - Secure login/registration with JWT tokens
- **Submit Complaints** - Create complaints with title, description, category, and priority
- **File Attachments** - Upload files to support complaints
- **Real-time Updates** - Live complaint status updates via Socket.io
- **Complaint Tracking** - View complaint history and current status
- **Comments & Feedback** - Collaborate with support team via comments
- **Dashboard** - Personalized dashboard with complaint overview

### 👨‍💼 Support Team Features
- **Complaint Management** - View, filter, and manage all complaints
- **Status Updates** - Update complaint status (OPEN → IN_PROGRESS → RESOLVED → CLOSED)
- **Activity Timeline** - Track all changes and interactions
- **Analytics Dashboard** - View complaint statistics and metrics
- **Priority Management** - Assign and manage complaint priorities
- **Response Comments** - Provide feedback directly to users

### 🔐 Admin Capabilities
- **Full System Access** - Manage all complaints and users
- **User Management** - Create SUPPORT users, view all users
- **Block/Unblock Users** - Control user access with blocking mechanism
- **Admin Dashboard** - Statistics and management interface
- **Analytics Insights** - Comprehensive reporting and analytics

### ⏰ SLA & Escalation System
- **Automatic SLA Deadlines** - Calculated based on complaint priority
  - Critical: 2 hours
  - High: 8 hours
  - Medium: 24 hours
  - Low: 48 hours
- **Auto-Escalation** - Complaints exceeding SLA automatically escalated
- **Priority Adjustment** - Escalation increases priority level
- **Escalation History** - Track all escalation events with reasons
- **SLA Metrics Dashboard** - Real-time compliance tracking for admins
- **Scheduler Service** - Runs every 5 minutes to check SLA violations
- **Escalation Notifications** - Real-time alerts when complaints escalate

### ⚡ Real-time Features
- **Socket.io Integration** - Instant notifications for complaint updates
- **Live Status Changes** - Users and support staff see updates immediately
- **Multi-device Support** - Seamless sync across multiple browser tabs

---

## 🛠️ Tech Stack

### Frontend
- **React** (v19.2.4) - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Chart.js & react-chartjs-2** - Data visualization
- **Socket.io Client** - Real-time communication
- **React-Toastify** - Notifications
- **CSS3** - Styling

### Backend
- **Node.js** - Runtime environment
- **Express.js** (v4.18.2) - Web framework
- **Socket.io** (v4.8.3) - Real-time communication
- **MongoDB** - NoSQL database
- **Mongoose** (v8.0.3) - ODM for MongoDB
- **JWT** - Authentication & authorization
- **Bcryptjs** - Password hashing
- **Express-validator** - Input validation
- **Multer** - File upload handling
- **CORS** - Cross-origin support

### Development Tools
- **Nodemon** - Auto-restart server on changes
- **Concurrently** - Run multiple scripts simultaneously
- **React Scripts** - Build and test tools

---

## 📁 Project Structure

```
FSD15_MERNSTACK/
├── client/                      # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── AppShell.js
│   │   │   ├── Navbar.js
│   │   │   ├── ComplaintForm.js
│   │   │   ├── ComplaintList.js
│   │   │   ├── CommentPanel.js
│   │   │   ├── SearchFilter.js
│   │   │   ├── Pagination.js
│   │   │   └── ActivityTimeline.js
│   │   ├── context/             # React Context API
│   │   │   ├── AuthContext.js   # Authentication state
│   │   │   ├── SocketContext.js # WebSocket state
│   │   │   └── ThemeContext.js  # Theme management
│   │   ├── pages/               # Page components
│   │   │   ├── Home.js
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Analytics.js
│   │   │   └── AdminPanel.js    # Admin management dashboard
│   │   ├── services/
│   │   │   └── api.js           # API client configuration
│   │   ├── App.js               # Main app component
│   │   └── index.js             # Entry point
│   └── package.json
│
├── server/                      # Express backend
│   ├── models/                  # MongoDB schemas
│   │   ├── User.js
│   │   ├── Complaint.js
│   │   ├── Comment.js
│   │   └── Feedback.js
│   ├── routes/                  # API endpoints
│   │   ├── auth.js
│   │   ├── complaints.js
│   │   ├── comments.js
│   │   ├── analytics.js
│   │   ├── feedback.js
│   │   └── admin.js             # Admin management routes
│   ├── controllers/             # Business logic
│   │   └── adminController.js   # Admin operations
│   ├── middleware/              # Custom middleware
│   │   ├── auth.js              # JWT verification & authorization
│   │   └── upload.js            # File upload configuration
│   ├── utils/                   # Utility functions
│   │   ├── complaintHelper.js   # Assignment and workflow logic
│   │   └── slaHelper.js         # SLA calculation and escalation logic
│   ├── scheduler/               # Background jobs
│   │   └── slaScheduler.js      # SLA violation checker (runs every 5 minutes)
│   ├── uploads/                 # Uploaded files
│   ├── server.js                # Main server file (initializes SLA scheduler)
│   ├── seed.js                  # Database seeding
│   └── package.json
│
├── package.json                 # Root package.json
├── render.yaml                  # Deployment configuration
├── START.bat                    # Windows startup script
└── README.md                    # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** or **yarn**
- **MongoDB** (local or MongoDB Atlas connection string)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FSD15_MERNSTACK
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```
   This installs dependencies for both server and client.

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/complaint-management
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # Frontend
   FRONTEND_URL=http://localhost:3000
   
   # JWT
   JWT_SECRET=your_secret_key_here
   
   # File Upload
   UPLOAD_DIR=./server/uploads
   MAX_FILE_SIZE=5242880
   ```

### Running the Application

#### Development Mode (Windows)
```bash
# Using the provided script
START.bat

# Or manually run both servers
npm run dev
```

#### Development Mode (Manual)
```bash
# Terminal 1: Start server
npm run server

# Terminal 2: Start client
npm run client
```

#### Production Build
```bash
npm run build
```

#### Seed Database (Optional)
```bash
npm run seed
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Complaints
- `GET /api/complaints` - Get all complaints (role-based filtering)
- `POST /api/complaints` - Create new complaint (USER)
- `GET /api/complaints/:id` - Get complaint details
- `PUT /api/complaints/:id` - Update complaint status
- `DELETE /api/complaints/:id` - Delete complaint
- `POST /api/complaints/:id/assign` - Assign complaint to support user (ADMIN)
- `PUT /api/complaints/:id/reassign` - Reassign to different support user (ADMIN)
- `DELETE /api/complaints/:id/unassign` - Unassign complaint (ADMIN)
- `GET /api/complaints/stats/by-status` - Get complaint statistics by status (role-based)
- `GET /api/complaints/:id/sla-status` - Get SLA status for specific complaint
- `GET /api/complaints/sla/metrics` - Get SLA metrics and compliance (ADMIN only)

### Comments
- `GET /api/comments/:complaintId` - Get comments for a complaint
- `POST /api/comments` - Add comment to complaint
- `DELETE /api/comments/:id` - Delete comment

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard metrics
- `GET /api/analytics/complaints-by-category` - Category breakdown
- `GET /api/analytics/complaints-by-status` - Status breakdown

### Feedback
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback` - Get all feedback

### Admin Management (ADMIN ONLY)
- `POST /api/admin/create-support` - Create new SUPPORT user
- `GET /api/admin/users` - Get all users with filtering & pagination
- `PUT /api/admin/block-user/:id` - Block a user
- `PUT /api/admin/unblock-user/:id` - Unblock a user
- `GET /api/admin/stats` - Get admin dashboard statistics

---

## 🔐 Authentication & Authorization

The system uses **JWT (JSON Web Tokens)** for authentication and implements **role-based access control**:

### User Roles
- **USER** - Regular users who can submit and track complaints
- **SUPPORT** - Support staff who manage complaints and view analytics
- **ADMIN** - Full system access

### Protected Routes
All API endpoints (except login/register) require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 📊 Database Models

### User
- Email, password (hashed)
- Full name
- Role (USER, SUPPORT, ADMIN)
- Blocked status with optional reason
- Created/Updated timestamps

### Complaint
- Title, description
- Category (Technical, Billing, Service, Product, Other)
- Priority (Low, Medium, High, Critical)
- Status with workflow: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
- Assigned to Support user (assignedTo reference)
- Assignment timestamp (assignedAt)
- Attachment file reference
- User reference (who created the complaint)
- Created/Updated timestamps

### Comment
- Content
- Author (User reference)
- Complaint reference
- Created/Updated timestamps

### Feedback
- Rating
- Message
- User reference
- Complaint reference
- Created timestamp

---

## 🎨 UI Features

### Responsive Design
- Mobile-friendly interface
- Desktop and tablet optimized
- Dark/Light theme support

### Key Pages

| Page | Purpose |
|------|---------|
| Home | Landing page with system information |
| Login | User authentication |
| Register | New user account creation |
| Dashboard | User's complaint overview and submissions |
| Analytics | Support team statistics and insights |
| Admin Panel | Admin management dashboard (ADMIN ONLY) |

---

## 🧪 Testing

Run tests for the client:
```bash
npm test --prefix client
```

---

## � Complaint Assignment System

The complaint system features advanced assignment and workflow management with role-based access control.

### Status Workflow

Complaints follow a structured workflow to ensure proper handling:
```
OPEN → ASSIGNED → ESCALATED (if SLA exceeded) → IN_PROGRESS → RESOLVED → CLOSED
```

Each status represents a distinct phase in complaint resolution:
- **OPEN** - New complaint, awaiting assignment
- **ASSIGNED** - Admin assigned to support agent
- **ESCALATED** - Auto-marked when SLA deadline exceeded, priority increased
- **IN_PROGRESS** - Support agent is actively working on it
- **RESOLVED** - Issue is resolved, awaiting closure confirmation
- **CLOSED** - Complaint is closed, final state

### Role-Based Complaint Visibility

The system implements intelligent filtering based on user roles:

**USER Role:**
- Can only see their own complaints
- Can submit new complaints and add comments
- Receives real-time notifications on status updates

**SUPPORT Role:**
- Sees only complaints assigned to them
- Can update status following the workflow
- Can add comments and collaborate with users
- Cannot see unassigned complaints

**ADMIN Role:**
- Sees all complaints in the system
- Can assign/reassign complaints to support staff
- Can unassign complaints
- Enforces workflow compliance
- Full access to assignment management

### Assignment Endpoints

**Assign Complaint to Support User** (ADMIN)
```bash
curl -X POST http://localhost:5000/api/complaints/{complaintId}/assign \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"supportUserId": "{supportUserId}"}'
```

Response:
```json
{
  "message": "Complaint assigned successfully",
  "complaint": {
    "_id": "...",
    "title": "...",
    "status": "ASSIGNED",
    "assignedTo": {
      "_id": "...",
      "name": "Support Agent",
      "email": "agent@example.com",
      "role": "SUPPORT"
    },
    "assignedAt": "2026-04-16T10:30:00Z"
  }
}
```

**Reassign Complaint** (ADMIN)
```bash
curl -X PUT http://localhost:5000/api/complaints/{complaintId}/reassign \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"supportUserId": "{newSupportUserId}"}'
```

**Unassign Complaint** (ADMIN)
```bash
# Reverts complaint to OPEN status
curl -X DELETE http://localhost:5000/api/complaints/{complaintId}/unassign \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Get Complaint Statistics by Status** (All authenticated users)
```bash
# Role-based filtering: shows stats relevant to the user's role
curl -X GET http://localhost:5000/api/complaints/stats/by-status \
  -H "Authorization: Bearer <USER_TOKEN>"

# Response includes counts for each status
# USER sees only their own complaint stats
# SUPPORT sees stats for their assigned complaints
# ADMIN sees all complaint stats
```

### Update Complaint Status

Support staff can update complaint status following the workflow:

```bash
curl -X PUT http://localhost:5000/api/complaints/{complaintId} \
  -H "Authorization: Bearer <SUPPORT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "priority": "High"
  }'

# Available next statuses are returned in response
# Response includes: availableNextStatuses: ["RESOLVED", "CLOSED"]
```

**Workflow Rules:**
- Can only transition to the next status or skip intermediate stages
- Cannot go backwards in the workflow (e.g., RESOLVED → ASSIGNED is invalid)
- CLOSED is the final state (no transitions from CLOSED)
- Status transitions are validated server-side

### Real-time Assignment Notifications

When a complaint is assigned, support agents receive real-time notifications via Socket.io:

```json
{
  "event": "complaintAssigned",
  "data": {
    "complaintId": "...",
    "title": "...",
    "priority": "High",
    "assignedAt": "2026-04-16T10:30:00Z"
  }
}
```

### Filtering Complaints

**For Support Staff** - Get assigned complaints with filtering:
```bash
# Get page 1 of assigned complaints
curl -X GET "http://localhost:5000/api/complaints?page=1&limit=10" \
  -H "Authorization: Bearer <SUPPORT_TOKEN>"

# Filter by status
curl -X GET "http://localhost:5000/api/complaints?status=IN_PROGRESS" \
  -H "Authorization: Bearer <SUPPORT_TOKEN>"

# Filter by priority
curl -X GET "http://localhost:5000/api/complaints?priority=Critical" \
  -H "Authorization: Bearer <SUPPORT_TOKEN>"

# Search by keyword
curl -X GET "http://localhost:5000/api/complaints?search=database+error" \
  -H "Authorization: Bearer <SUPPORT_TOKEN>"
```

---
## ⏰ SLA & Escalation Management System

The system implements intelligent Service Level Agreements (SLA) with automatic escalation to ensure timely complaint resolution.

### SLA Configuration

Each complaint is assigned an SLA deadline based on its priority level:

| Priority | SLA Duration | Example Deadline |
|----------|-------------|-----------------|
| **Critical** | 2 hours | Urgent system outages, security issues |
| **High** | 8 hours | Major functionality broken |
| **Medium** | 24 hours | Non-critical functionality affected |
| **Low** | 48 hours | Minor issues, feature requests |

### SLA Deadline Calculation

When a complaint is created, the system automatically calculates the SLA deadline:

```javascript
// Example: Critical priority complaint created at 10:00 AM
// SLA Deadline: 12:00 PM (2 hours later)

// Medium priority complaint created at Monday 9:00 AM
// SLA Deadline: Tuesday 9:00 AM (24 hours later)
```

### Auto-Escalation Process

A background scheduler runs every **5 minutes** to check for SLA violations:

1. **Check:** Find all open/active complaints exceeding their SLA deadline
2. **Escalate:** Mark complaint with `ESCALATED` status
3. **Update:** Increase priority level (e.g., Medium → High, High → Critical)
4. **Record:** Store escalation history with timestamp and reason
5. **Notify:** Alert assigned support agent via Socket.io

**Example Escalation Flow:**
```
Original: OPEN (Medium priority, 24-hour SLA)
           ↓
After 24+ hours: ESCALATED (High priority, 8-hour SLA)
           ↓
After 8+ more hours: Priority increases to Critical (2-hour SLA)
```

### Escalation History

Each escalation is recorded with full details:

```json
{
  "escalationHistory": [
    {
      "escalatedAt": "2026-04-16T15:30:00Z",
      "reason": "SLA_EXCEEDED",
      "previousPriority": "Medium",
      "newPriority": "High",
      "notes": "SLA Exceeded - Medium priority complaint exceeded 24-hour SLA by 2h 15m overdue",
      "escalatedBy": null // null for auto-escalation
    }
  ]
}
```

### SLA Status API

**Get SLA Status for a Complaint**
```bash
curl -X GET http://localhost:5000/api/complaints/{complaintId}/sla-status \
  -H "Authorization: Bearer <USER_TOKEN>"

# Response:
# {
#   "status": "Overdue",
#   "priority": "High",
#   "slaHours": 8,
#   "slaDeadline": "2026-04-16T18:00:00Z",
#   "timeRemaining": {
#     "hours": 0,
#     "minutes": 0,
#     "seconds": 0,
#     "isOverdue": true,
#     "overdueDuration": "2h 15m overdue"
#   },
#   "isEscalated": true,
#   "escalatedAt": "2026-04-16T15:30:00Z",
#   "escalationHistory": [...]
# }
```

**Possible SLA Status Values:**
- `On Track` - Within SLA deadline, no escalation
- `Critical - Less than 1 hour` - Warning: approaching deadline
- `Overdue` - Exceeded SLA but not yet auto-escalated (shouldn't happen long)
- `Escalated` - Auto-escalated due to SLA violation

### SLA Metrics Dashboard (Admin)

Admins can view overall SLA compliance metrics:

```bash
curl -X GET http://localhost:5000/api/complaints/sla/metrics \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Response:
# {
#   "totalOpenComplaints": 25,
#   "onTrack": 20,                    # Within SLA
#   "atRisk": 3,                      # Within 1 hour of deadline
#   "overdue": 1,                     # Exceeded SLA (before escalation)
#   "escalated": 1,                   # Auto-escalated
#   "slaCompliance": "80.00%"         # (onTrack / total) * 100
# }
```

### SLA Workflow Example

```
1. User creates "Database Connection Down" complaint (Critical) at 10:00 AM
   → SLA Deadline: 12:00 PM (2 hours)
   → Status: OPEN

2. Admin assigns to support agent (10:30 AM)
   → Status: ASSIGNED
   → Deadline still 12:00 PM

3. Support agent starts working (11:00 AM)
   → Status: IN_PROGRESS
   → Deadline still 12:00 PM

4. Scheduler runs at 11:30 AM (30 min before deadline)
   ✓ Check passes - still within SLA

5. Support agent resolves (1:30 PM - 30 mins AFTER deadline)
   → Status: RESOLVED
   ✓ SLA exceeded but still being resolved

6. Scheduler runs at 1:35 PM
   → Complaint already RESOLVED/CLOSED
   ✓ SLA check skipped for resolved complaints

7. Support agent closes (2:00 PM)
   → Status: CLOSED
   ✓ No further SLA checks
```

### Scheduler Configuration

The SLA scheduler is initialized automatically when the server starts:

```javascript
// In server.js
const slaScheduler = initializeScheduler(5 * 60 * 1000); // Check every 5 minutes
slaScheduler.start();
```

**Scheduler Output (Logs):**
```
[SLA Scheduler] Starting SLA checker (interval: 5 minutes)
[SLA Scheduler] Running escalation check at 2026-04-16T10:00:00Z
[SLA Scheduler] ✓ Escalated 2 complaint(s)
  - ID: 507f1f77bcf86cd799439011, Title: "Database Down", Priority: Medium → High, Overdue: 2h 30m overdue
  - ID: 507f1f77bcf86cd799439012, Title: "Payment Failed", Priority: Low → Medium, Overdue: 1d 4h overdue
[SLA Scheduler] Check completed in 47ms
```

### Integration Points

**Creating a Complaint:**
- SLA deadline automatically calculated from priority
- Stored in `slaDeadline` field

**Updating Complaint Status:**
- Status transitions validated against workflow including ESCALATED state
- Resolved/Closed complaints don't trigger SLA checks

**Real-time Notifications:**
- Socket.io event emitted when complaint escalates
- Support agent receives instant notification

---
## �👑 Admin Management Module

The Admin Panel provides comprehensive user and system management capabilities. Only users with the ADMIN role can access these features.

### Admin Dashboard Features

**1. Dashboard Tab**
- View system statistics at a glance
- Total users, admins, support staff, and customers
- Active vs blocked user counts
- Real-time metrics

**2. Users Tab**
- View all registered users
- Filter by role (USER, SUPPORT, ADMIN)
- Filter by status (Active/Blocked)
- Search by name or email
- Paginated results (10 users per page)
- Block/unblock users with optional reasons

**3. Create Support Tab**
- Create new SUPPORT user accounts
- Set user credentials (name, email, password)
- Only ADMIN can create SUPPORT users
- Form validation with clear feedback

### Admin API Usage

**Authenticate as Admin:**
```bash
# Login as admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'
# Get token from response
```

**Create SUPPORT User:**
```bash
curl -X POST http://localhost:5000/api/admin/create-support \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Support Agent",
    "email": "agent@example.com",
    "password": "secure123"
  }'
```

**Get All Users with Filters:**
```bash
# Get all users (page 1, 10 per page)
curl -X GET http://localhost:5000/api/admin/users?page=1&limit=10 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Filter by role
curl -X GET http://localhost:5000/api/admin/users?role=SUPPORT \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Filter by status
curl -X GET http://localhost:5000/api/admin/users?blocked=true \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Search by name or email
curl -X GET "http://localhost:5000/api/admin/users?search=john" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Block a User:**
```bash
curl -X PUT http://localhost:5000/api/admin/block-user/{userId} \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Violates terms of service"}'
```

**Unblock a User:**
```bash
curl -X PUT http://localhost:5000/api/admin/unblock-user/{userId} \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Get Admin Statistics:**
```bash
curl -X GET http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Accessing Admin Panel

1. Login as admin user: `admin@demo.com / admin123`
2. Navigate to `/admin` route
3. View and manage users, create SUPPORT accounts, and monitor system statistics

---

## � Role Permissions Summary

| Feature | USER | SUPPORT | ADMIN |
|---------|------|---------|-------|
| Submit Complaints | ✅ | ❌ | ✅ |
| View Own Complaints | ✅ | ❌ | ✅ |
| View Assigned Complaints | ❌ | ✅ | ✅ |
| Manage All Complaints | ❌ | ✅ | ✅ |
| Update Complaint Status | ❌ | ✅ | ✅ |
| Assign Complaints | ❌ | ❌ | ✅ |
| Reassign Complaints | ❌ | ❌ | ✅ |
| Unassign Complaints | ❌ | ❌ | ✅ |
| View Analytics | ❌ | ✅ | ✅ |
| View All Users | ❌ | ❌ | ✅ |
| Create SUPPORT Users | ❌ | ❌ | ✅ |
| Block/Unblock Users | ❌ | ❌ | ✅ |
| Access Admin Panel | ❌ | ❌ | ✅ |
| System Administration | ❌ | ❌ | ✅ |

---

## �📦 Build & Deployment

### Build for Production
```bash
npm run build
```

### Deployment to Render
The project includes a `render.yaml` configuration file for easy deployment to Render.com.

### Docker Support (Optional)
Create a Dockerfile for containerization if needed.

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📝 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | Database connection string | `mongodb://localhost:27017/complaint-management` |
| `PORT` | Server port | `5000` |
| `JWT_SECRET` | Secret key for JWT signing | Any strong random string |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `NODE_ENV` | Environment type | `development` or `production` |

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9   # macOS/Linux
netstat -ano | findstr :5000    # Windows
```

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network access (if using MongoDB Atlas)

### CORS Errors
- Ensure `FRONTEND_URL` matches your client URL
- Check that `http://localhost:3000` is accessible

---

## 📄 License

ISC License - Feel free to use this project for your needs.

---

## 👨‍💻 Author

Full Stack Development - FSD15_MERNSTACK

---

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the code comments
3. Refer to MERN stack documentation

---

**Happy coding! 🚀**
