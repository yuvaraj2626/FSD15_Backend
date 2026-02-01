# 🚀 Quick Start Guide

## Prerequisites
- ✅ Node.js installed (v14+)
- ✅ MongoDB Atlas account
- ✅ Git (optional)

## Step-by-Step Setup

### 1️⃣ MongoDB Configuration

**IMPORTANT:** Before running the application, you need to configure MongoDB Atlas.

Please read `MONGODB_SETUP.md` for detailed instructions.

**Quick Fix:**
1. Go to MongoDB Atlas → Database Access
2. Create a new user or update existing user password
3. Use a password WITHOUT special characters (e.g., `yuvaraj26`)
4. Update `.env` file with the correct credentials

### 2️⃣ Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3️⃣ Configure Environment

Edit the `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
JWT_SECRET=your_super_secret_jwt_key_change_in_production_2026
PORT=5000
NODE_ENV=development
```

Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your MongoDB credentials.

### 4️⃣ Seed Database (Optional but Recommended)

This creates demo users and sample data:

```bash
npm run seed
```

**Expected Output:**
```
✅ Connected to MongoDB
🗑️  Cleared existing data
👥 Created demo users
📝 Created demo complaints
⭐ Created demo feedback
✅ Database seeded successfully!
```

### 5️⃣ Start the Application

**Option A: Use the batch file (Windows)**
```bash
START.bat
```
This will open two command windows - one for backend, one for frontend.

**Option B: Use npm script**
```bash
npm run dev
```

**Option C: Run separately**
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

### 6️⃣ Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/api/health

## 🎯 Demo Accounts

After seeding the database, you can login with:

### User Account
- **Email:** user@demo.com
- **Password:** user123
- **Can:** Submit complaints, track status, provide feedback

### Support Account
- **Email:** support@demo.com
- **Password:** support123
- **Can:** View all complaints, update status, view feedback

## 📱 Using the Application

### As a User:
1. **Register** or **Login** with demo credentials
2. **Submit a Complaint** - Click "New Complaint" button
3. **Track Status** - View your complaints in the dashboard
4. **Provide Feedback** - Only available for CLOSED complaints

### As Support:
1. **Login** with support credentials
2. **View All Complaints** - See complaints from all users
3. **Update Status** - Change complaint status (OPEN → IN_PROGRESS → RESOLVED → CLOSED)
4. **View Feedback** - See user feedback at the bottom

## 🔍 Testing the Critical Business Rule

**Feedback can ONLY be submitted for CLOSED complaints:**

1. Login as USER (user@demo.com)
2. Try to provide feedback for an OPEN complaint → ❌ Button won't appear
3. Wait for support to close a complaint
4. Now the "Provide Feedback" button appears → ✅ Can submit feedback

## 🛠️ Troubleshooting

### MongoDB Connection Error
- Check `MONGODB_SETUP.md` for detailed solutions
- Verify your MongoDB Atlas credentials
- Ensure Network Access is configured (whitelist your IP)

### Port Already in Use
```bash
# Kill process on port 5000 (Backend)
npx kill-port 5000

# Kill process on port 3000 (Frontend)
npx kill-port 3000
```

### Dependencies Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules client/node_modules
npm run install-all
```

## 📁 Project Structure

```
FSD15_MERNSTACK/
├── server/                 # Backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── middleware/        # Auth middleware
│   ├── seed.js           # Database seeding
│   └── server.js         # Express server
├── client/                # Frontend
│   ├── public/           # Static files
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       ├── context/      # Auth context
│       ├── services/     # API services
│       └── App.js        # Main app
├── .env                  # Environment variables
├── package.json          # Backend dependencies
├── START.bat            # Windows startup script
└── README.md            # Documentation
```

## 🎨 Features to Explore

1. **Glassmorphism UI** - Modern, translucent design
2. **Smooth Animations** - Hover effects and transitions
3. **Role-Based Dashboards** - Different views for USER and SUPPORT
4. **Real-time Stats** - Live complaint statistics
5. **Status Tracking** - Visual status badges
6. **Feedback System** - 5-star rating with comments

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Complaints
- `GET /api/complaints` - Get complaints (role-based)
- `POST /api/complaints` - Create complaint (USER)
- `PUT /api/complaints/:id` - Update status (SUPPORT)

### Feedback
- `POST /api/feedback` - Submit feedback (USER, CLOSED only)
- `GET /api/feedback` - Get all feedback

## 🎓 Learning Points

This project demonstrates:
- ✅ Full-stack MERN development
- ✅ JWT authentication
- ✅ Role-based authorization
- ✅ RESTful API design
- ✅ Modern React patterns
- ✅ Responsive UI/UX
- ✅ Business logic enforcement
- ✅ Database modeling

## 💡 Tips

1. **Use Chrome DevTools** to inspect network requests
2. **Check Console** for any errors
3. **MongoDB Compass** can help visualize your database
4. **Postman** is great for testing API endpoints

## 🆘 Need Help?

1. Check `README.md` for detailed documentation
2. Read `MONGODB_SETUP.md` for database issues
3. Verify all dependencies are installed
4. Make sure both servers are running

---

**Happy Coding! 🚀**
