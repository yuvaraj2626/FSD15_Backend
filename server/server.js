require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// ── CORS ──────────────────────────────────────────────────────
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

const corsOptions = {
    origin: FRONTEND_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded attachments
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── HTTP server + Socket.io ───────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ── Socket.io connection handler ─────────────────────────────
// We keep a map of  userId → Set<socketId>  so one user can
// connect from multiple tabs and still receive all events.
const userSocketMap = new Map(); // userId → Set<socketId>

io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client emits 'register' right after connecting, passing their userId
    socket.on('register', (userId) => {
        if (!userId) return;

        if (!userSocketMap.has(userId)) {
            userSocketMap.set(userId, new Set());
        }
        userSocketMap.get(userId).add(socket.id);

        // Keep the socket in a named room so we can target it easily
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId} joined room user:${userId} (socket ${socket.id})`);
    });

    socket.on('disconnect', () => {
        // Remove socket id from all user entries
        for (const [userId, sockets] of userSocketMap.entries()) {
            sockets.delete(socket.id);
            if (sockets.size === 0) userSocketMap.delete(userId);
        }
        console.log(`❌ Socket disconnected: ${socket.id}`);
    });
});

// Attach io to app so routes can access it via req.app.get('io')
app.set('io', io);

// ── MongoDB Connection ────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Complaint Management System API is running',
        timestamp: new Date().toISOString()
    });
});

// ── Error handlers ────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 API URL: http://localhost:${PORT}`);
    console.log(`⚡ Socket.io ready`);
});
