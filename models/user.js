/* ============================================================
   TwatChat — models/user.js
   ============================================================ */

'use strict';

const mongoose            = require('mongoose');
const bcrypt              = require('bcryptjs');
const { generateUserCode } = require('../utils/helpers');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: '' },
    lastName:  { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },

    phone:    { type: String, trim: true, default: '' },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    // ── Unique shareable code e.g. "TC-4829-XK" ───────────
    userCode: {
      type:    String,
      unique:  true,
      default: generateUserCode,
    },

    avatarClass: { type: String, default: 'av-0' },
    avatarUrl:   { type: String, default: '' },
    initials:    { type: String, default: 'U' },

    isOnline:  { type: Boolean, default: false },
    lastSeen:  { type: Date,    default: Date.now },
    socketId:  { type: String,  default: '' },

    settings: {
      notifications: { type: Boolean, default: true  },
      onlineStatus:  { type: Boolean, default: true  },
      searchable:    { type: Boolean, default: true  },
      hiddenMode:    { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// ── Index for fast code lookup ─────────────────────────────
userSchema.index({ userCode: 1 });

// ── Single pre-save hook ───────────────────────────────────
userSchema.pre('save', async function () {
  // Auto-set displayName
  const f = (this.firstName || '').trim();
  const l = (this.lastName  || '').trim();

  if (!this.displayName) {
    this.displayName = f && l
      ? `${f} ${l}`
      : f || this.email.split('@')[0];
  }

  // Auto-set initials
  if (!this.initials || this.initials === 'U') {
    if (f && l)  this.initials = (f[0] + l[0]).toUpperCase();
    else if (f)  this.initials = f.slice(0, 2).toUpperCase();
    else         this.initials = 'U';
  }

  // Hash password only if modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// ── Compare password ───────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);