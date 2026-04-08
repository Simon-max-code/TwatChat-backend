/* ============================================================
   TwatChat — controllers/authCTRL.js
   register | login | getMe | updatePassword
   ============================================================ */

'use strict';

const User            = require('../models/user');
const { generateToken } = require('../services/token');

// ── Helpers ────────────────────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  res.status(statusCode).json({
    token,
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
      usernameChanges: user.usernameChanges,
      userCode:    user.userCode, 
      settings:    user.settings,
      createdAt:   user.createdAt,
    },
  });
};

// ── @POST /api/auth/register ───────────────────────────────
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Check duplicate email
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/auth/login ──────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Explicitly select password (it's select:false on the schema)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
                           .select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/auth/me  (protected) ────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.user attached by protect middleware
    res.json({
      user: {
        _id:         req.user._id,
        firstName:   req.user.firstName,
        lastName:    req.user.lastName,
        displayName: req.user.displayName,
        email:       req.user.email,
        phone:       req.user.phone,
        avatarClass: req.user.avatarClass,
        avatarUrl:   req.user.avatarUrl,
        initials:    req.user.initials,
        usernameChanges: req.user.usernameChanges,
        userCode:    req.user.userCode, 
        isOnline:    req.user.isOnline,
        settings:    req.user.settings,
        createdAt:   req.user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/auth/password  (protected) ──────────────────
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }

    // Re-fetch with password
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save(); // triggers bcrypt pre-save hook

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updatePassword };