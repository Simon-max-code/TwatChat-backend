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

      const user = await User.findById(userId);
      if (!user) return;

      // Store socketId on user document
      user.isOnline = true;
      user.socketId = socket.id;
      user.lastSeen = new Date();
      await user.save();

      // Join a personal room (userId) so others can target this user
      socket.join(String(userId));

      // Broadcast to everyone if user allows online status
      if (user.settings?.onlineStatus !== false) {
        socket.broadcast.emit('presence:update', {
          userId,
          isOnline: true,
        });
      }

      console.log(`🟢 User online: ${userId} (status: ${user.settings?.onlineStatus !== false ? 'visible' : 'hidden'})`);
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
  const user = await User.findById(userId);
  if (!user) return;

  user.isOnline = false;
  user.socketId = '';
  user.lastSeen = new Date();
  await user.save();

  // Broadcast only if user allows online status
  if (user.settings?.onlineStatus !== false) {
    io.emit('presence:update', {
      userId,
      isOnline: false,
      lastSeen: new Date(),
    });
  }

  console.log(`🔴 User offline: ${userId} (status: ${user.settings?.onlineStatus !== false ? 'visible' : 'hidden'})`);
};