/* ============================================================
   TwatChat — controllers/msgCtrl.js
   sendMessage | sendMedia | getMessages | deleteMessage | clearChat
   ============================================================ */

'use strict';

const Message                          = require('../models/message');
const Chat                             = require('../models/chat');
const { getIO }                        = require('../config/socket');
const { uploadToCloudinary,
        deleteFromCloudinary }         = require('../utils/cloudinary');

// ── Helper: notify members via socket ─────────────────────
const notifyMembers = async (io, chat, message, senderId) => {
  const chatId = String(chat._id);

  // Emit to chat room (members who have chat open)
  io.to(chatId).emit('message:new', { message, chatId });

  // Emit to each member's personal room (sidebar update)
  chat.members.forEach((memberId) => {
    if (String(memberId) !== String(senderId)) {
      io.to(String(memberId)).emit('chat:newMessage', {
        chatId,
        message,
        unreadCount: chat.unreadCounts.get(String(memberId)) || 0,
      });
    }
  });
};

// ── @POST /api/chats/:chatId/messages  (protected) ────────
const sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const { chatId } = req.params;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const chat = await Chat.findOne({ _id: chatId, members: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    let message = await Message.create({
      chat:   chatId,
      sender: req.user._id,
      text:   text.trim(),
    });

    message = await Message.findById(message._id)
      .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl');

    // Update chat
    chat.lastMessage = message._id;
    chat.members.forEach((memberId) => {
      if (String(memberId) !== String(req.user._id)) {
        const current = chat.unreadCounts.get(String(memberId)) || 0;
        chat.unreadCounts.set(String(memberId), current + 1);
      }
    });
    await chat.save();

    // Socket emit
    try {
      const io = getIO();
      await notifyMembers(io, chat, message, req.user._id);
    } catch (_) {}

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/:chatId/messages/media  (protected) ──
// Handles image, video, and voice note uploads
const sendMedia = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { caption = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const chat = await Chat.findOne({ _id: chatId, members: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // ── Determine file type ────────────────────────────────
    const mime = req.file.mimetype;
    let fileType = 'image';
    if (mime.startsWith('video/'))  fileType = 'video';
    if (mime.startsWith('audio/'))  fileType = 'audio';

    // ── Upload to Cloudinary ───────────────────────────────
    const cloudinaryOptions = {
      resource_type: fileType === 'image' ? 'image' : 'video', // video handles audio too
      folder:        `twatchat/${fileType}s`,
    };

    // For videos generate a thumbnail
    if (fileType === 'video') {
      cloudinaryOptions.eager = [
        { width: 400, height: 300, crop: 'fill', format: 'jpg' }
      ];
    }

    const result = await uploadToCloudinary(req.file.buffer, cloudinaryOptions);

    // ── Build attachment object ────────────────────────────
    const attachment = {
      url:          result.secure_url,
      publicId:     result.public_id,
      fileType,
      fileName:     req.file.originalname || '',
      mimeType:     mime,
      size:         req.file.size,
      duration:     result.duration     || 0,
      width:        result.width        || 0,
      height:       result.height       || 0,
      thumbnailUrl: result.eager?.[0]?.secure_url || '',
    };

    // ── Create message ─────────────────────────────────────
    let message = await Message.create({
      chat:        chatId,
      sender:      req.user._id,
      text:        caption.trim(),
      attachments: [attachment],
    });

    message = await Message.findById(message._id)
      .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl');

    // Update chat
    chat.lastMessage = message._id;
    chat.members.forEach((memberId) => {
      if (String(memberId) !== String(req.user._id)) {
        const current = chat.unreadCounts.get(String(memberId)) || 0;
        chat.unreadCounts.set(String(memberId), current + 1);
      }
    });
    await chat.save();

    // Socket emit
    try {
      const io = getIO();
      await notifyMembers(io, chat, message, req.user._id);
    } catch (_) {}

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats/:chatId/messages  (protected) ─────────
const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 40;
    const skip  = (page - 1) * limit;

    const chat = await Chat.findOne({ _id: chatId, members: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Reset unread count
    chat.unreadCounts.set(String(req.user._id), 0);
    await chat.save();

    const messages = await Message.find({
      chat:       chatId,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'firstName lastName displayName initials avatarClass avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
        pages:   Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/:chatId/messages/:msgId  (protected)─
const deleteMessage = async (req, res, next) => {
  try {
    const { chatId, msgId } = req.params;

    const message = await Message.findOne({ _id: msgId, chat: chatId });
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (String(message.sender) === String(req.user._id)) {
      // Hard delete — also remove from Cloudinary
      if (message.attachments?.length) {
        await Promise.allSettled(
          message.attachments.map(att =>
            deleteFromCloudinary(att.publicId, att.fileType === 'image' ? 'image' : 'video')
          )
        );
      }

      await Message.findByIdAndDelete(msgId);

      try {
        const io = getIO();
        io.to(chatId).emit('message:deleted', { msgId, chatId });
      } catch (_) {}
    } else {
      // Soft delete for this user only
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
const clearChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId, members: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    await Message.updateMany(
      { chat: chatId },
      { $addToSet: { deletedFor: req.user._id } }
    );

    chat.unreadCounts.set(String(req.user._id), 0);
    await chat.save();

    res.json({ message: 'Chat cleared' });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, sendMedia, getMessages, deleteMessage, clearChat };