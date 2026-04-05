/* ============================================================
   TwatChat — config/socket.js
   Socket.io initialization + namespace wiring
   ============================================================ */

'use strict';

const { Server } = require('socket.io');

const chatSocket     = require('../socket/chat');
const presenceSocket = require('../socket/presence');
const typingSocket   = require('../socket/typing');

let io; // exported so controllers can emit if needed

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        const ALLOWED = [
          'https://twat-chat.vercel.app',
          'http://localhost:3000',
          'http://localhost:5500',
          'http://127.0.0.1:5500',
        ];

        if (!origin) return callback(null, true);
        if (ALLOWED.includes(origin)) return callback(null, true);
        if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);

        callback(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },

    // Render free tier can be slow — generous timeouts
    pingTimeout:  60000,
    pingInterval: 25000,

    // Allow both websocket and polling (polling = fallback for Render cold starts)
    transports: ['websocket', 'polling'],
  });

  // ── Connection ─────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Wire up feature handlers
    chatSocket(io, socket);
    presenceSocket(io, socket);
    typingSocket(io, socket);

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} — ${reason}`);
    });

    // ── Error ────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`⚠️  Socket error [${socket.id}]:`, err.message);
    });
  });

  console.log('📡 Socket.io initialized');
  return io;
};

// Export io instance so controllers can emit outside of socket context
const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = initSocket;
module.exports.getIO = getIO;