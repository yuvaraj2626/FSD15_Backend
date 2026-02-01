# Render Deployment Guide - Complaint Management System

## 🚀 Deploy to Render

This guide will help you deploy both the backend and frontend to Render.

---

## 📋 Prerequisites

1. **Render Account** - Sign up at https://render.com (free tier available)
2. **GitHub Repositories** - Already done! ✅
   - Backend: https://github.com/yuvaraj2626/FSD15_Backend
   - Frontend: https://github.com/yuvaraj2626/FSD15_Frontend
3. **MongoDB Atlas** - Already configured! ✅

---

## 🔧 Part 1: Deploy Backend (Web Service)

### Step 1: Create New Web Service

1. **Go to:** https://dashboard.render.com/
2. **Click:** "New +" button → "Web Service"
3. **Connect GitHub:** Authorize Render to access your repositories
4. **Select Repository:** `FSD15_Backend`

### Step 2: Configure Web Service

**Basic Settings:**
- **Name:** `complaint-management-backend` (or your choice)
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** Leave empty
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node server/server.js`

**Instance Type:**
- Select: **Free** (for testing) or **Starter** (for production)

### Step 3: Add Environment Variables

Click "Advanced" → "Add Environment Variable" and add these:

```
MONGODB_URI = mongodb+srv://yuvarajramu:Yuvaraj%4026@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15

JWT_SECRET = your_super_secret_jwt_key_change_in_production_2026

PORT = 5000

NODE_ENV = production
```

**Important:** Use your actual MongoDB connection string!

### Step 4: Deploy

1. **Click:** "Create Web Service"
2. **Wait:** Render will build and deploy (takes 2-5 minutes)
3. **Copy URL:** You'll get a URL like: `https://complaint-management-backend.onrender.com`

### Step 5: Test Backend

Visit: `https://your-backend-url.onrender.com/api/health`

You should see:
```json
{
  "status": "OK",
  "message": "Complaint Management System API is running"
}
```

---

## 🎨 Part 2: Deploy Frontend (Static Site)

### Step 1: Update API URL in Frontend

Before deploying frontend, update the API URL:

**Option A: Update in code**
Edit `client/src/services/api.js`:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-url.onrender.com/api';
```

**Option B: Use environment variable (Recommended)**
We'll set this in Render dashboard.

### Step 2: Create New Static Site

1. **Go to:** https://dashboard.render.com/
2. **Click:** "New +" button → "Static Site"
3. **Select Repository:** `FSD15_Frontend`

### Step 3: Configure Static Site

**Basic Settings:**
- **Name:** `complaint-management-frontend` (or your choice)
- **Branch:** `main`
- **Root Directory:** Leave empty
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `build`

### Step 4: Add Environment Variable

Click "Advanced" → "Add Environment Variable":

```
REACT_APP_API_URL = https://your-backend-url.onrender.com/api
```

Replace `your-backend-url` with your actual backend URL from Part 1.

### Step 5: Deploy

1. **Click:** "Create Static Site"
2. **Wait:** Render will build and deploy (takes 3-7 minutes)
3. **Copy URL:** You'll get a URL like: `https://complaint-management-frontend.onrender.com`

---

## 🔄 Part 3: Update CORS (Backend)

After deploying frontend, update backend CORS settings:

### Option 1: Update via Render Dashboard

1. Go to your backend service on Render
2. Click "Environment"
3. Add new environment variable:
```
FRONTEND_URL = https://your-frontend-url.onrender.com
```

### Option 2: Update Code (Recommended)

Update `server/server.js`:

```javascript
const cors = require('cors');

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));
```

Then push to GitHub:
```bash
cd c:\users\yuvar\FSD15_MERNSTACK
git add .
git commit -m "Update CORS for production"
git push origin main
```

Render will auto-deploy the changes!

---

## ✅ Part 4: Verify Deployment

### Test Backend:
```
https://your-backend-url.onrender.com/api/health
```

### Test Frontend:
```
https://your-frontend-url.onrender.com
```

### Test Login:
1. Open frontend URL
2. Login with demo credentials:
   - Email: `user@demo.com`
   - Password: `user123`

---

## 🎯 Part 5: Seed Production Database (Optional)

If you want demo data in production:

1. **Go to:** Render Dashboard → Your Backend Service
2. **Click:** "Shell" tab
3. **Run:** `npm run seed`

Or update the seed script to run automatically on first deploy.

---

## 🔧 Troubleshooting

### Backend Issues

**Problem:** "Application failed to respond"
- Check logs in Render dashboard
- Verify MongoDB connection string
- Ensure PORT is set to 5000

**Problem:** "Module not found"
- Check build logs
- Verify package.json has all dependencies

### Frontend Issues

**Problem:** "API calls failing"
- Check REACT_APP_API_URL is correct
- Verify backend CORS settings
- Check browser console for errors

**Problem:** "Build failed"
- Check build logs in Render
- Verify all dependencies are in package.json

### CORS Issues

**Problem:** "CORS policy blocked"
- Update backend CORS to allow frontend URL
- Add environment variable FRONTEND_URL
- Redeploy backend

---

## 📱 Auto-Deploy Setup

Render automatically deploys when you push to GitHub!

```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# Render will auto-deploy! 🚀
```

---

## 💰 Pricing

### Free Tier Limitations:
- Backend spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month free

### Upgrade Options:
- **Starter ($7/month):** Always on, faster
- **Standard ($25/month):** More resources

---

## 🌐 Custom Domain (Optional)

### For Frontend:
1. Go to Static Site settings
2. Click "Custom Domain"
3. Add your domain (e.g., complaints.yourdomain.com)
4. Update DNS records as instructed

### For Backend:
1. Go to Web Service settings
2. Click "Custom Domain"
3. Add your domain (e.g., api.yourdomain.com)
4. Update DNS records

---

## 📊 Monitoring

### View Logs:
- Go to service → "Logs" tab
- See real-time application logs

### View Metrics:
- Go to service → "Metrics" tab
- See CPU, memory, bandwidth usage

---

## 🔐 Security Best Practices

1. **Change JWT Secret** in production
2. **Use strong MongoDB password**
3. **Enable MongoDB IP whitelist** (add Render IPs)
4. **Use HTTPS** (automatic with Render)
5. **Set NODE_ENV=production**

---

## ✅ Deployment Checklist

### Backend:
- [ ] Web Service created
- [ ] Environment variables set
- [ ] MongoDB connection working
- [ ] Health endpoint responding
- [ ] CORS configured

### Frontend:
- [ ] Static Site created
- [ ] API URL configured
- [ ] Build successful
- [ ] Site accessible
- [ ] Login working

---

## 🎉 Success!

Your Complaint Management System is now live!

**Backend:** https://your-backend-url.onrender.com
**Frontend:** https://your-frontend-url.onrender.com

Share your live app with anyone! 🚀

---

## 📝 Quick Deploy Commands

```bash
# Update backend
cd c:\users\yuvar\FSD15_MERNSTACK
git add .
git commit -m "Update backend"
git push origin main

# Update frontend
cd c:\users\yuvar\FSD15_MERNSTACK\client
git add .
git commit -m "Update frontend"
git push origin main
```

Render will auto-deploy both! ✨
