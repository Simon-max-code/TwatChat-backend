/* ============================================================
   TwatChat — models/chat.js
   Handles both DMs and group chats
   ============================================================ */

'use strict';

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    // ── DM or group ──────────────────────────────────────
    isGroup: {
      type: Boolean,
      default: false,
    },

    // ── Group only fields ─────────────────────────────────
    name: {
      type: String,
      trim: true,
      default: '',
    },

    icon: {
      type: String,
      default: '🚀',
    },

    // ── Members (DM = 2, group = 2+) ──────────────────────
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ── Group admin ───────────────────────────────────────
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Last message preview (for sidebar list) ───────────
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // ── Per-member unread counts ──────────────────────────
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    // ── Muted members ─────────────────────────────────────
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ── Index for fast lookup of a user's chats ────────────────
chatSchema.index({ members: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);