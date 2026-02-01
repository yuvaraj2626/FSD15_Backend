# 🚀 Quick Render Deployment Checklist

## ✅ Pre-Deployment (Already Done!)

- [x] Code pushed to GitHub
  - Backend: https://github.com/yuvaraj2626/FSD15_Backend
  - Frontend: https://github.com/yuvaraj2626/FSD15_Frontend
- [x] MongoDB Atlas configured
- [x] CORS updated for production
- [x] Environment variables ready

---

## 📋 Deployment Steps

### 1️⃣ Deploy Backend (5 minutes)

1. Go to: https://dashboard.render.com/
2. Click: **New +** → **Web Service**
3. Connect: **GitHub** → Select `FSD15_Backend`
4. Configure:
   ```
   Name: complaint-management-backend
   Runtime: Node
   Build: npm install
   Start: node server/server.js
   Plan: Free
   ```
5. Add Environment Variables:
   ```
   MONGODB_URI = mongodb+srv://yuvarajramu:Yuvaraj%4026@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
   JWT_SECRET = your_super_secret_jwt_key_change_in_production_2026
   PORT = 5000
   NODE_ENV = production
   ```
6. Click: **Create Web Service**
7. Wait for deployment
8. Copy your backend URL (e.g., `https://complaint-management-backend.onrender.com`)

### 2️⃣ Deploy Frontend (7 minutes)

1. Click: **New +** → **Static Site**
2. Select: `FSD15_Frontend`
3. Configure:
   ```
   Name: complaint-management-frontend
   Build: npm install && npm run build
   Publish: build
   ```
4. Add Environment Variable:
   ```
   REACT_APP_API_URL = https://YOUR-BACKEND-URL.onrender.com/api
   ```
   (Replace with your actual backend URL from step 1)
5. Click: **Create Static Site**
6. Wait for deployment
7. Copy your frontend URL

### 3️⃣ Update Backend CORS

1. Go to backend service in Render
2. Click: **Environment**
3. Add variable:
   ```
   FRONTEND_URL = https://YOUR-FRONTEND-URL.onrender.com
   ```
4. Service will auto-redeploy

### 4️⃣ Test Deployment

1. Open frontend URL
2. Login with:
   - Email: `user@demo.com`
   - Password: `user123`
3. Test creating a complaint
4. Test all features

---

## 🎯 Important URLs

**Render Dashboard:** https://dashboard.render.com/

**Your Repositories:**
- Backend: https://github.com/yuvaraj2626/FSD15_Backend
- Frontend: https://github.com/yuvaraj2626/FSD15_Frontend

**MongoDB Atlas:** https://cloud.mongodb.com/

---

## 🔧 Environment Variables Reference

### Backend (.env for local, Render dashboard for production)
```
MONGODB_URI = mongodb+srv://yuvarajramu:Yuvaraj%4026@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
JWT_SECRET = your_super_secret_jwt_key_change_in_production_2026
PORT = 5000
NODE_ENV = production
FRONTEND_URL = https://your-frontend-url.onrender.com
```

### Frontend (Render dashboard)
```
REACT_APP_API_URL = https://your-backend-url.onrender.com/api
```

---

## 🆘 Troubleshooting

### Backend won't start?
- Check logs in Render dashboard
- Verify MongoDB connection string
- Ensure all environment variables are set

### Frontend can't connect to backend?
- Check REACT_APP_API_URL is correct
- Verify backend CORS has frontend URL
- Check browser console for errors

### CORS errors?
- Add FRONTEND_URL to backend environment
- Redeploy backend
- Clear browser cache

---

## 📱 Auto-Deploy

Every time you push to GitHub, Render auto-deploys!

```bash
# Update backend
cd c:\users\yuvar\FSD15_MERNSTACK
git add .
git commit -m "Update"
git push origin main

# Update frontend
cd c:\users\yuvar\FSD15_MERNSTACK\client
git add .
git commit -m "Update"
git push origin main
```

---

## ✅ Success Criteria

- [ ] Backend deployed and responding at `/api/health`
- [ ] Frontend deployed and loading
- [ ] Login working
- [ ] Can create complaints
- [ ] Can update status (as support)
- [ ] Can provide feedback (for closed complaints)

---

## 🎉 You're Done!

Your app is live on Render! Share the frontend URL with anyone!

**Need detailed instructions?** See `RENDER_DEPLOYMENT.md`
