/* ============================================================
   TwatChat — socket/presence.js
   Online / offline presence tracking
   ============================================================ */

'use strict';

const User = require('../models/user');

module.exports = (io, socket) => {

  // ── User comes online ─────────────────────────────────────
  // Frontend emits this right after socket connects + auth
  socket.on('presence:online', async ({ userId }) => {
    try {
      if (!userId) return;

      // Store socketId on user document
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date(),
      });

      // Join a personal room (userId) so others can target this user
      socket.join(String(userId));

      // Broadcast to everyone that this user is online
      socket.broadcast.emit('presence:update', {
        userId,
        isOnline: true,
      });

      console.log(`🟢 User online: ${userId}`);
    } catch (err) {
      console.error('socket presence:online error:', err.message);
    }
  });

  // ── User goes offline (explicit) ──────────────────────────
  socket.on('presence:offline', async ({ userId }) => {
    try {
      if (!userId) return;
      await markOffline(userId, io);
    } catch (err) {
      console.error('socket presence:offline error:', err.message);
    }
  });

  // ── Auto-offline on disconnect ────────────────────────────
  socket.on('disconnect', async () => {
    try {
      // Find user by socketId and mark offline
      const user = await User.findOne({ socketId: socket.id });
      if (!user) return;
      await markOffline(user._id, io);
    } catch (err) {
      console.error('socket disconnect presence error:', err.message);
    }
  });

};

// ── Shared helper ─────────────────────────────────────────
const markOffline = async (userId, io) => {
  await User.findByIdAndUpdate(userId, {
    isOnline: false,
    socketId: '',
    lastSeen: new Date(),
  });

  // Broadcast to everyone
  io.emit('presence:update', {
    userId,
    isOnline: false,
    lastSeen: new Date(),
  });

  console.log(`🔴 User offline: ${userId}`);
};