/* ============================================================
   TwatChat — controllers/msgCtrl.js
   sendMessage | getMessages | deleteMessage | clearChat
   ============================================================ */

'use strict';

const Message       = require('../models/message');
const Chat          = require('../models/chat');
const { getIO }     = require('../config/socket');

// ── @POST /api/chats/:chatId/messages  (protected) ────────
const sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const { chatId } = req.params;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    // Verify user is a member of this chat
    const chat = await Chat.findOne({
      _id:     chatId,
      members: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Create message
    let message = await Message.create({
      chat:   chatId,
      sender: req.user._id,
      text:   text.trim(),
    });

    // Populate sender for socket emit + response
    message = await Message.findById(message._id)
      .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl');

    // Update chat's lastMessage + updatedAt + unread counts
    chat.lastMessage = message._id;

    // Increment unread for all members except sender
    chat.members.forEach((memberId) => {
      if (String(memberId) !== String(req.user._id)) {
        const current = chat.unreadCounts.get(String(memberId)) || 0;
        chat.unreadCounts.set(String(memberId), current + 1);
      }
    });

    await chat.save();

    // ── Emit to all members in the chat room via Socket.io ─
    try {
      const io = getIO();
      io.to(chatId).emit('message:new', { message, chatId });
    } catch (_) {
      // Socket not critical — don't fail the HTTP response
    }

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats/:chatId/messages  (protected) ─────────
// Paginated — ?page=1&limit=40
const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 40;
    const skip  = (page - 1) * limit;

    // Verify membership
    const chat = await Chat.findOne({
      _id:     chatId,
      members: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const messages = await Message.find({
      chat:       chatId,
      deletedFor: { $ne: req.user._id }, // exclude soft-deleted
    })
      .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl')
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    // Return in chronological order for rendering
    messages.reverse();

    const total = await Message.countDocuments({
      chat:       chatId,
      deletedFor: { $ne: req.user._id },
    });

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/:chatId/messages/:msgId  (protected)─
// Soft-delete a single message for the requesting user
const deleteMessage = async (req, res, next) => {
  try {
    const { chatId, msgId } = req.params;

    const message = await Message.findOne({
      _id:  msgId,
      chat: chatId,
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can hard-delete; anyone can soft-delete for themselves
    if (String(message.sender) === String(req.user._id)) {
      // Hard delete — remove for everyone
      await Message.findByIdAndDelete(msgId);

      try {
        const io = getIO();
        io.to(chatId).emit('message:deleted', { msgId, chatId });
      } catch (_) {}
    } else {
      // Soft delete — hide only for this user
      await Message.findByIdAndUpdate(msgId, {
        $addToSet: { deletedFor: req.user._id },
      });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/:chatId/messages  (protected) ──────
// Clear all messages in a chat for the requesting user
const clearChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    // Verify membership
    const chat = await Chat.findOne({
      _id:     chatId,
      members: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Soft-delete all messages for this user
    await Message.updateMany(
      { chat: chatId },
      { $addToSet: { deletedFor: req.user._id } }
    );

    // Reset unread count for this user
    chat.unreadCounts.set(String(req.user._id), 0);
    await chat.save();

    res.json({ message: 'Chat cleared' });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, getMessages, deleteMessage, clearChat };