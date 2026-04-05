/* ============================================================
   TwatChat — models/user.js
   ============================================================ */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      default: '',
    },

    lastName: {
      type: String,
      trim: true,
      default: '',
    },

    displayName: {
      type: String,
      trim: true,
      default: '',
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },

    phone: {
      type: String,
      trim: true,
      default: '',
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries by default
    },

    avatarClass: {
      type: String,
      default: 'av-0',
    },

    avatarUrl: {
      type: String,     // Cloudinary URL if user uploads a photo
      default: '',
    },

    initials: {
      type: String,
      default: 'U',
    },

    // ── Online presence ──────────────────────────────────
    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    socketId: {
      type: String,
      default: '',
    },

    // ── Privacy settings ─────────────────────────────────
    settings: {
      notifications:  { type: Boolean, default: true  },
      onlineStatus:   { type: Boolean, default: true  },
      searchable:     { type: Boolean, default: true  },
      hiddenMode:     { type: Boolean, default: false },
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// ── Hash password before saving ────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Compare password (used in login) ──────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// ── Auto-set initials + displayName before saving ─────────
userSchema.pre('save', function (next) {
  const f = (this.firstName || '').trim();
  const l = (this.lastName  || '').trim();

  if (!this.displayName) {
    this.displayName = f && l ? `${f} ${l}` : f || this.email.split('@')[0];
  }

  if (!this.initials || this.initials === 'U') {
    if (f && l) this.initials = (f[0] + l[0]).toUpperCase();
    else if (f)  this.initials = f.slice(0, 2).toUpperCase();
    else         this.initials = 'U';
  }

  next();
});

module.exports = mongoose.model('User', userSchema);