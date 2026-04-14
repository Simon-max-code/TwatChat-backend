/* ============================================================
   TwatChat — controllers/chatCtrl.js
   createChat | getChats | getChat | createGroup |
   updateGroup | leaveGroup | deleteChat |
   generateInvite | joinByInvite
   ============================================================ */

'use strict';

const Chat                = require('../models/chat');
const Message             = require('../models/message');
const User                = require('../models/user');
const { generateInviteCode } = require('../utils/helpers');

// ── @POST /api/chats ───────────────────────────────────────
const createChat = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    let chat = await Chat.findOne({
      isGroup:  false,
      members: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate('members',     '-password')
      .populate('lastMessage');

    if (chat) return res.json({ chat });

    chat = await Chat.create({
      isGroup: false,
      members: [req.user._id, userId],
    });

    chat = await Chat.findById(chat._id).populate('members', '-password');
    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats ────────────────────────────────────────
const getChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ members: req.user._id })
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen userCode')
      .populate({
        path:     'lastMessage',
        populate: { path: 'sender', select: 'firstName lastName displayName initials avatarClass' },
      })
      .sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats/:id ────────────────────────────────────
const getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, members: req.user._id })
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen userCode')
      .populate('admin',   'firstName lastName displayName initials avatarClass')
      .populate({
        path:     'lastMessage',
        populate: { path: 'sender', select: 'firstName lastName displayName initials avatarClass' },
      });

    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    chat.unreadCounts.set(String(req.user._id), 0);
    await chat.save();

    res.json({ chat });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/group ─────────────────────────────────
const createGroup = async (req, res, next) => {
  try {
    const { name, icon, memberIds } = req.body;

    if (!name)                       return res.status(400).json({ message: 'Group name is required' });
    if (!memberIds?.length)          return res.status(400).json({ message: 'Add at least one member' });

    const members = [...new Set([String(req.user._id), ...memberIds])];

    const chat = await Chat.create({
      isGroup: true,
      name:    name.trim(),
      icon:    icon || '🚀',
      members,
      admin:   req.user._id,
    });

    const populated = await Chat.findById(chat._id)
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline userCode')
      .populate('admin',   'firstName lastName displayName initials avatarClass');

    res.status(201).json({ chat: populated });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/chats/group/:id ──────────────────────────────
const updateGroup = async (req, res, next) => {
  try {
    const { name, icon } = req.body;

    const chat = await Chat.findOne({ _id: req.params.id, isGroup: true, admin: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Group not found or not authorised' });

    if (name) chat.name = name.trim();
    if (icon) chat.icon = icon;
    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline userCode')
      .populate('admin',   'firstName lastName displayName initials avatarClass');

    res.json({ chat: populated });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/group/:id/leave ────────────────────
const leaveGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, isGroup: true, members: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Group not found' });

    chat.members = chat.members.filter(m => String(m) !== String(req.user._id));

    if (String(chat.admin) === String(req.user._id)) {
      chat.admin = chat.members[0] || null;
    }

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

// ── @DELETE /api/chats/:id ─────────────────────────────────
const deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, members: req.user._id, isGroup: false });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    await Message.updateMany({ chat: chat._id }, { $addToSet: { deletedFor: req.user._id } });

    chat.members = chat.members.filter(m => String(m) !== String(req.user._id));

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

// ── @POST /api/chats/group/:id/invite  (admin only) ───────
// Generates or returns existing invite link for a group
const generateInvite = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, isGroup: true, admin: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Group not found or not authorised' });

    // Generate new code if none exists or if refresh requested
    if (!chat.inviteCode || req.body.refresh) {
      chat.inviteCode  = generateInviteCode();
    }

    chat.inviteActive = true;
    await chat.save();

    res.json({
      inviteCode: chat.inviteCode,
      inviteLink: `${process.env.CLIENT_URL || 'https://twat-chat.vercel.app'}?join=${chat.inviteCode}`,
    });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/join/:inviteCode  (protected) ────────
// Any logged-in user can join a group via invite link
const joinByInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.params;

    const chat = await Chat.findOne({ inviteCode, isGroup: true, inviteActive: true });
    if (!chat) return res.status(404).json({ message: 'Invalid or expired invite link' });

    // Already a member
    const isMember = chat.members.some(m => String(m) === String(req.user._id));
    if (isMember) return res.status(400).json({ message: 'You are already in this group' });

    chat.members.push(req.user._id);
    await chat.save();

    // ── Ban check ──────────────────────────────────────────
    const isBanned = chat.bannedUsers.some(u => String(u) === String(req.user._id));
    if (isBanned) {
      return res.status(403).json({ message: 'You have been banned from this group' });
    }

    const populated = await Chat.findById(chat._id)
      .populate('members', 'firstName lastName displayName email avatarClass avatarUrl initials isOnline userCode')
      .populate('admin',   'firstName lastName displayName initials avatarClass');

    res.json({ chat: populated, message: `Joined "${chat.name}" successfully` });
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
  generateInvite,
  joinByInvite,
};