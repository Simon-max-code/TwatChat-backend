/* ============================================================
   TwatChat — controllers/userCtrl.js
   getUsers | getUser | findByCode | updateProfile | deleteAccount
   ============================================================ */

'use strict';

const User    = require('../models/user');
const Chat    = require('../models/chat');
const Message = require('../models/message');

// ── @GET /api/users  (protected) ──────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const search = req.query.search
      ? {
          $or: [
            { displayName: { $regex: req.query.search, $options: 'i' } },
            { email:       { $regex: req.query.search, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find({
      ...search,
      _id: { $ne: req.user._id },
    }).select('_id firstName lastName displayName avatarClass avatarUrl initials isOnline lastSeen userCode');

    res.json({ users });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/users/find/:code  (protected) ───────────────
// Find a user by their unique TC-XXXX-XX code
// Returns limited profile — NO email exposed
const findByCode = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const user = await User.findOne({ userCode: code })
      .select('_id displayName firstName lastName avatarClass avatarUrl initials isOnline userCode');

    if (!user) {
      return res.status(404).json({ message: 'No user found with that code' });
    }

    // Don't return yourself
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'That\'s your own code!' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/users/:id  (protected) ──────────────────────
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id firstName lastName displayName avatarClass avatarUrl initials isOnline lastSeen userCode');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/users/profile  (protected) ──────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatarClass, avatarUrl, settings } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (firstName   !== undefined) user.firstName   = firstName;
    if (lastName    !== undefined) user.lastName    = lastName;
    if (phone       !== undefined) user.phone       = phone;
    if (avatarClass !== undefined) user.avatarClass = avatarClass;
    if (avatarUrl   !== undefined) user.avatarUrl   = avatarUrl;

    if (settings) {
      user.settings = { ...user.settings.toObject(), ...settings };
    }

    // Recompute displayName + initials
    const f = (user.firstName || '').trim();
    const l = (user.lastName  || '').trim();
    user.displayName = f && l ? `${f} ${l}` : f || user.email.split('@')[0];
    user.initials    = f && l
      ? (f[0] + l[0]).toUpperCase()
      : f ? f.slice(0, 2).toUpperCase() : 'U';

    await user.save();

    res.json({
      message: 'Profile updated',
      user: {
        _id:         user._id,
        firstName:   user.firstName,
        lastName:    user.lastName,
        displayName: user.displayName,
        email:       user.email,
        phone:       user.phone,
        avatarClass: user.avatarClass,
        avatarUrl:   user.avatarUrl,
        initials:    user.initials,
        userCode:    user.userCode,
        settings:    user.settings,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/users/username  (protected) ─────────────────
const updateUsername = async (req, res, next) => {
  try {
    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ message: 'Display name is required' });
    }

    const clean = displayName.trim();

    // Basic validation — no special chars except spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9 _\-]{2,30}$/.test(clean)) {
      return res.status(400).json({
        message: 'Username must be 2–30 characters. Letters, numbers, spaces, _ and - only.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const MAX_CHANGES = 3;

    if (user.usernameChanges >= MAX_CHANGES) {
      return res.status(403).json({
        message: `You've used all ${MAX_CHANGES} username changes.`,
        changesUsed: user.usernameChanges,
        changesLeft: 0,
      });
    }

    user.customDisplayName = clean;
    user.displayName       = clean;
    user.usernameChanges   += 1;

    // Recompute initials from custom name
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      user.initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
      user.initials = clean.slice(0, 2).toUpperCase();
    }

    await user.save();

    // Update stored session user
    res.json({
      message:     'Username updated',
      changesUsed: user.usernameChanges,
      changesLeft: MAX_CHANGES - user.usernameChanges,
      user: {
        _id:             user._id,
        displayName:     user.displayName,
        initials:        user.initials,
        usernameChanges: user.usernameChanges,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/users/me  (protected) ────────────────────
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Chat.updateMany({ members: userId }, { $pull: { members: userId } });
    await Chat.deleteMany({ $expr: { $lt: [{ $size: '$members' }, 2] } });
    await Message.updateMany({ sender: userId }, { $addToSet: { deletedFor: userId } });
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUser, findByCode, updateProfile, updateUsername, deleteAccount };