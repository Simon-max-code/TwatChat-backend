/* ============================================================
   TwatChat — socket/chat.js
   Join/leave chat rooms + real-time message events
   ============================================================ */

'use strict';

const Message = require('../models/message');
const Chat    = require('../models/chat');

module.exports = (io, socket) => {

  // ── Join a chat room ──────────────────────────────────────
  // Frontend emits this when a chat is opened
  socket.on('chat:join', ({ chatId }) => {
    if (!chatId) return;
    socket.join(chatId);
    console.log(`💬 Socket ${socket.id} joined room: ${chatId}`);
  });

  // ── Leave a chat room ─────────────────────────────────────
  // Frontend emits this when navigating away from a chat
  socket.on('chat:leave', ({ chatId }) => {
    if (!chatId) return;
    socket.leave(chatId);
    console.log(`🚪 Socket ${socket.id} left room: ${chatId}`);
  });

  // ── Send message via socket ───────────────────────────────
  // Alternative to REST POST — used for instant delivery
  socket.on('message:send', async ({ chatId, text, senderId }) => {
    try {
      if (!chatId || !text || !senderId) return;

      // Verify sender is a member
      const chat = await Chat.findOne({
        _id:     chatId,
        members: senderId,
      });

      if (!chat) return;

      // Persist to DB
      let message = await Message.create({
        chat:   chatId,
        sender: senderId,
        text:   text.trim(),
      });

      message = await Message.findById(message._id)
        .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl');

      // Update chat lastMessage + unread counts
      chat.lastMessage = message._id;

      chat.members.forEach((memberId) => {
        if (String(memberId) !== String(senderId)) {
          const current = chat.unreadCounts.get(String(memberId)) || 0;
          chat.unreadCounts.set(String(memberId), current + 1);
        }
      });

      await chat.save();

      // Broadcast to everyone in the room (including sender)
      io.to(chatId).emit('message:new', { message, chatId });

      // Notify members who are online but not in this room
      // (updates their sidebar unread badge)
      chat.members.forEach((memberId) => {
        if (String(memberId) !== String(senderId)) {
          io.to(String(memberId)).emit('chat:updated', {
            chatId,
            lastMessage: message,
            unreadCount: chat.unreadCounts.get(String(memberId)) || 0,
          });
        }
      });

    } catch (err) {
      console.error('socket message:send error:', err.message);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ── Mark messages as read ─────────────────────────────────
  socket.on('chat:read', async ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) return;

      const chat = await Chat.findOne({
        _id:     chatId,
        members: userId,
      });

      if (!chat) return;

      // Reset unread count
      chat.unreadCounts.set(String(userId), 0);
      await chat.save();

      // Confirm back to sender
      socket.emit('chat:read:confirmed', { chatId });

    } catch (err) {
      console.error('socket chat:read error:', err.message);
    }
  });

};