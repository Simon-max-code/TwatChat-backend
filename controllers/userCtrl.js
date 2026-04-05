/* ============================================================
   TwatChat — controllers/userCtrl.js
   getUsers | getUser | updateProfile | deleteAccount
   ============================================================ */

'use strict';

const User = require('../models/user');
const Chat = require('../models/chat');
const Message = require('../models/message');

// ── @GET /api/users  (protected) ──────────────────────────
// Returns all users except the logged-in user
// Supports ?search= query for sidebar search
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
      _id: { $ne: req.user._id }, // exclude self
    }).select('_id firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen');

    res.json({ users });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/users/:id  (protected) ──────────────────────
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id firstName lastName displayName email avatarClass avatarUrl initials isOnline lastSeen');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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

    // Only update fields that were actually sent
    if (firstName  !== undefined) user.firstName  = firstName;
    if (lastName   !== undefined) user.lastName   = lastName;
    if (phone      !== undefined) user.phone      = phone;
    if (avatarClass !== undefined) user.avatarClass = avatarClass;
    if (avatarUrl  !== undefined) user.avatarUrl  = avatarUrl;

    // Merge settings (don't wipe unset keys)
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
        settings:    user.settings,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/users/me  (protected) ────────────────────
// Soft-wipe: removes user + their messages + chats they're sole member of
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Remove user from all chats they're in
    await Chat.updateMany(
      { members: userId },
      { $pull: { members: userId } }
    );

    // Delete chats that now have fewer than 2 members
    await Chat.deleteMany({ members: { $size: 0 } });
    await Chat.deleteMany({ $expr: { $lt: [{ $size: '$members' }, 2] } });

    // Soft-delete their messages (add to deletedFor)
    await Message.updateMany(
      { sender: userId },
      { $addToSet: { deletedFor: userId } }
    );

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUser, updateProfile, deleteAccount };