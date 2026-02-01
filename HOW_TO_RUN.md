# 🚀 How to Run the Complaint Management System

## 📋 Quick Start Commands

### Option 1: Using the Batch File (Windows - Easiest!)
```bash
# Just double-click this file:
START.bat
```
This will automatically start both backend and frontend servers in separate windows.

---

### Option 2: Using NPM Scripts

#### Start Both Servers Together (Recommended)
```bash
# Navigate to project folder
cd c:\users\yuvar\FSD15_MERNSTACK

# Start both backend and frontend
npm run dev
```

#### Start Servers Separately
```bash
# Terminal 1 - Backend Server
cd c:\users\yuvar\FSD15_MERNSTACK
npm run server

# Terminal 2 - Frontend Server (open a new terminal)
cd c:\users\yuvar\FSD15_MERNSTACK\client
npm start
```

---

## 🌐 Access the Application

Once the servers are running, open your browser and go to:
```
http://localhost:3000
```

**Backend API:** http://localhost:5000

---

## 🔑 Demo Login Credentials

### User Account
- **Email:** user@demo.com
- **Password:** user123

### Support Account
- **Email:** support@demo.com
- **Password:** support123

---

## 🛑 How to Stop the Servers

### If using START.bat or separate terminals:
- Press `Ctrl + C` in each terminal window
- Or simply close the terminal windows

### If using npm run dev:
- Press `Ctrl + C` once to stop both servers

---

## 🔧 Troubleshooting

### Port Already in Use
If you get "Port already in use" error:

```bash
# Kill process on port 5000 (Backend)
npx kill-port 5000

# Kill process on port 3000 (Frontend)
npx kill-port 3000

# Then restart the servers
npm run dev
```

### MongoDB Connection Error
If you get MongoDB connection error:

```bash
# Test the connection
node test-connection.js

# If it fails, check your .env file
# Make sure the password is: Yuvaraj@26 (URL-encoded as Yuvaraj%4026)
```

### Need to Reinstall Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd client
npm install
cd ..
```

---

## 📝 Complete Workflow

### First Time Setup (Already Done!)
```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Configure .env file (Already configured!)
# MONGODB_URI=mongodb+srv://yuvarajramu:Yuvaraj%4026@...

# 3. Seed the database (Already done!)
npm run seed
```

### Every Time You Want to Run the Project
```bash
# Option A: Double-click START.bat

# OR Option B: Run this command
cd c:\users\yuvar\FSD15_MERNSTACK
npm run dev

# Then open: http://localhost:3000
```

---

## 📂 Project Location
```
c:\users\yuvar\FSD15_MERNSTACK
```

---

## 🎯 Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both servers |
| `npm run server` | Start backend only |
| `npm run client` | Start frontend only |
| `npm run seed` | Seed database with demo data |
| `node test-connection.js` | Test MongoDB connection |
| `npx kill-port 5000` | Kill backend server |
| `npx kill-port 3000` | Kill frontend server |

---

## ✅ What Should Happen

When you run the project:

1. **Backend starts** on port 5000
   - You'll see: "✅ MongoDB Connected Successfully"
   - You'll see: "🚀 Server running on port 5000"

2. **Frontend starts** on port 3000
   - React app compiles
   - Browser opens automatically (or open manually)

3. **Application loads** at http://localhost:3000
   - Beautiful landing page appears
   - Login/Register buttons visible

---

## 🎨 Features to Explore

1. **Login** with demo credentials
2. **Submit complaints** (as USER)
3. **Update status** (as SUPPORT)
4. **Provide feedback** (only for CLOSED complaints)
5. **View statistics** on dashboard
6. **Test role-based access**

---

## 💡 Pro Tips

- **Keep both terminals open** while using the app
- **Use Chrome DevTools** (F12) to see network requests
- **Check terminal logs** if something doesn't work
- **MongoDB must be accessible** (already configured!)

---

## 🆘 Need Help?

Check these files:
- `README.md` - Full documentation
- `QUICKSTART.md` - Quick start guide
- `MONGODB_SETUP.md` - Database help
- `PROJECT_SUMMARY.md` - Feature list

---

**Happy Coding! 🚀**
