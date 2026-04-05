/* ============================================================
   TwatChat — controllers/chatCtrl.js
   createChat | getChats | getChat | createGroup |
   updateGroup | leaveGroup | deleteChat
   ============================================================ */

'use strict';

const Chat    = require('../models/chat');
const Message = require('../models/message');
const User    = require('../models/user');

// ── @POST /api/chats  (protected) ─────────────────────────
// Creates or returns existing DM between two users
const createChat = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Check if DM already exists between these two users
    let chat = await Chat.findOne({
      isGroup:  false,
      members: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate('members',     '-password')
      .populate('lastMessage');

    if (chat) return res.json({ chat });

    // Create new DM
    chat = await Chat.create({
      isGroup: false,
      members: [req.user._id, userId],
    });

    chat = await Chat.findById(chat._id)
      .populate('members', '-password');

    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats  (protected) ──────────────────────────
// Returns all chats for the logged-in user, sorted by latest activity
const getChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ members: req.user._id })
      .populate('members',     'firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen')
      .populate({
        path:     'lastMessage',
        populate: {
          path:   'sender',
          select: 'firstName lastName displayName initials avatarClass',
        },
      })
      .sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats/:id  (protected) ──────────────────────
const getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id:     req.params.id,
      members: req.user._id, // must be a member
    })
      .populate('members',     'firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen')
      .populate('admin',       'firstName lastName displayName initials avatarClass')
      .populate({
        path:     'lastMessage',
        populate: {
          path:   'sender',
          select: 'firstName lastName displayName initials avatarClass',
        },
      });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Reset unread count for this user
    chat.unreadCounts.set(String(req.user._id), 0);
    await chat.save();

    res.json({ chat });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/group  (protected) ───────────────────
const createGroup = async (req, res, next) => {
  try {
    const { name, icon, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'Add at least one member' });
    }

    // Always include the creator
    const members = [...new Set([String(req.user._id), ...memberIds])];

    const chat = await Chat.create({
      isGroup: true,
      name:    name.trim(),
      icon:    icon || '🚀',
      members,
      admin:   req.user._id,
    });

    const populated = await Chat.findById(chat._id)
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline')
      .populate('admin',   'firstName lastName displayName initials avatarClass');

    res.status(201).json({ chat: populated });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/chats/group/:id  (protected) ────────────────
// Admin only — update group name / icon
const updateGroup = async (req, res, next) => {
  try {
    const { name, icon } = req.body;

    const chat = await Chat.findOne({
      _id:     req.params.id,
      isGroup: true,
      admin:   req.user._id, // only admin can update
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found or not authorised' });
    }

    if (name) chat.name = name.trim();
    if (icon) chat.icon = icon;

    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline')
      .populate('admin',   'firstName lastName displayName initials avatarClass');

    res.json({ chat: populated });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/group/:id/leave  (protected) ───────
const leaveGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id:     req.params.id,
      isGroup: true,
      members: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Remove user from members
    chat.members = chat.members.filter(
      (m) => String(m) !== String(req.user._id)
    );

    // If admin leaves, assign next member as admin
    if (String(chat.admin) === String(req.user._id)) {
      chat.admin = chat.members[0] || null;
    }

    // If no members left, delete the group
    if (chat.members.length === 0) {
      await Chat.findByIdAndDelete(chat._id);
      await Message.deleteMany({ chat: chat._id });
      return res.json({ message: 'Group deleted (no members left)' });
    }

    await chat.save();

    res.json({ message: 'Left group successfully' });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/:id  (protected) ───────────────────
// Delete a DM chat + its messages for the requesting user
const deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id:     req.params.id,
      members: req.user._id,
      isGroup: false,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Soft-delete all messages for this user
    await Message.updateMany(
      { chat: chat._id },
      { $addToSet: { deletedFor: req.user._id } }
    );

    // Remove user from chat members
    chat.members = chat.members.filter(
      (m) => String(m) !== String(req.user._id)
    );

    // If both users deleted — remove chat entirely
    if (chat.members.length === 0) {
      await Chat.findByIdAndDelete(chat._id);
      await Message.deleteMany({ chat: chat._id });
    } else {
      await chat.save();
    }

    res.json({ message: 'Chat deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createChat,
  getChats,
  getChat,
  createGroup,
  updateGroup,
  leaveGroup,
  deleteChat,
};