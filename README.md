# Backend - Complaint Management System

Professional backend API for the Complaint Management System built with Node.js, Express, and MongoDB.

## 🚀 Tech Stack

- **Node.js** & **Express.js** - Server framework
- **MongoDB** - Database (MongoDB Atlas)
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## 📦 Installation

```bash
npm install
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
NODE_ENV=development
```

## 🚀 Running the Server

```bash
# Development mode with nodemon
npm run server

# Seed database with demo data
npm run seed
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Complaints
- `GET /api/complaints` - Get all complaints (role-based)
- `GET /api/complaints/:id` - Get single complaint
- `POST /api/complaints` - Create complaint (USER only)
- `PUT /api/complaints/:id` - Update complaint status (SUPPORT only)
- `DELETE /api/complaints/:id` - Delete complaint

### Feedback
- `GET /api/feedback` - Get all feedback (role-based)
- `GET /api/feedback/complaint/:id` - Get feedback for complaint
- `POST /api/feedback` - Submit feedback (USER only, CLOSED complaints only)

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Protected API routes
- Role-based access control
- Input validation and sanitization
- CORS enabled

## 📊 Database Models

- **User** - Authentication and role management
- **Complaint** - Complaint tracking with status flow
- **Feedback** - User feedback with ratings

## 🎯 Business Rules

⚠️ **Critical Rule:** Feedback can ONLY be submitted for CLOSED complaints

## 📝 License

MIT
