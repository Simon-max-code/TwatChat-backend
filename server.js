/* ============================================================
   TwatChat — server.js
   Entry point: Express + Socket.io + MongoDB
   Backend  → Render
   Frontend → Vercel
   ============================================================ */

'use strict';

const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const dotenv       = require('dotenv');
const connectDB    = require('./config/db');
const initSocket   = require('./config/socket');
const errorHandler = require('./middleware/error');

// ── Load env vars ──────────────────────────────────────────
dotenv.config();

const PORT = process.env.PORT || 5000; // Render injects this automatically

// Allowed origins:
//  • Your Vercel production URL  → no trailing slash!
//  • Vercel preview deployments  → *.vercel.app (handled by regex below)
//  • Local dev (Live Server / Vite / etc.)
const ALLOWED_ORIGINS = [
  'https://twat-chat.vercel.app',  // ✅ no trailing slash
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

// ── Connect to MongoDB ─────────────────────────────────────
connectDB();

// ── Express app ────────────────────────────────────────────
const app = express();

// ── Core middleware ────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile)
    if (!origin) return callback(null, true);

    // Allow exact matches (production + local)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    // Allow ALL Vercel preview deployment URLs (*.vercel.app)
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);

    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ───────────────────────────────────────────
// Render uses this to confirm the service is alive
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/chats', require('./routes/chat'));

// ── 404 handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────
app.use(errorHandler);

// ── HTTP server ────────────────────────────────────────────
const server = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────
initSocket(server);

// ── Start — 0.0.0.0 required by Render ────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TwatChat server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${ALLOWED_ORIGINS.join(', ')} + *.vercel.app`);
});

// ── Graceful shutdown ──────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});