# 🔧 MongoDB Setup Guide

## Issue: Authentication Failed

The MongoDB connection is failing due to authentication issues. Please follow these steps to fix it:

## Option 1: Update MongoDB Atlas Password (Recommended)

1. **Go to MongoDB Atlas** (https://cloud.mongodb.com/)
2. **Login** to your account
3. **Navigate to Database Access** (in the Security section)
4. **Find user** `yuvarajramu`
5. **Edit Password** - Click "Edit" button
6. **Set a new password** WITHOUT special characters (e.g., `yuvaraj26` instead of `yuvaraj@26`)
7. **Update the `.env` file** with the new password:
   ```
   MONGODB_URI=mongodb+srv://yuvarajramu:yuvaraj26@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
   ```

## Option 2: Create a New Database User

1. **Go to MongoDB Atlas** → **Database Access**
2. **Click "Add New Database User"**
3. **Username:** `complaint_admin`
4. **Password:** `ComplaintPass123` (or any password without special characters)
5. **Database User Privileges:** Select "Atlas admin" or "Read and write to any database"
6. **Click "Add User"**
7. **Update the `.env` file:**
   ```
   MONGODB_URI=mongodb+srv://complaint_admin:ComplaintPass123@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
   ```

## Option 3: Use URL-Encoded Password

If you want to keep the password `yuvaraj@26`, you need to URL-encode the special character:
- `@` becomes `%40`

Update `.env`:
```
MONGODB_URI=mongodb+srv://yuvarajramu:yuvaraj%4026@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15
```

## Additional Steps

### Check Network Access
1. Go to **Network Access** in MongoDB Atlas
2. Make sure your IP address is whitelisted
3. Or add `0.0.0.0/0` to allow access from anywhere (for development only)

### Verify Cluster Name
Make sure the cluster name in the connection string matches your actual cluster:
- Current: `fsd15.4ao4nc7.mongodb.net`
- You can find the correct connection string in MongoDB Atlas → **Connect** → **Connect your application**

## After Fixing

Once you've updated the MongoDB credentials:

1. **Test the connection** by running:
   ```bash
   npm run seed
   ```

2. **If successful**, you should see:
   ```
   ✅ Connected to MongoDB
   🗑️  Cleared existing data
   👥 Created demo users
   📝 Created demo complaints
   ⭐ Created demo feedback
   ✅ Database seeded successfully!
   ```

3. **Start the application**:
   ```bash
   npm run dev
   ```
   Or double-click `START.bat`

## Demo Credentials

After successful seeding, you can login with:

**User Account:**
- Email: `user@demo.com`
- Password: `user123`

**Support Account:**
- Email: `support@demo.com`
- Password: `support123`

---

**Need Help?** 
Make sure you have:
- ✅ Valid MongoDB Atlas account
- ✅ Database user created with correct password
- ✅ Network access configured
- ✅ Correct cluster connection string
