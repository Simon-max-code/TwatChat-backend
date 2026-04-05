/* ============================================================
   TwatChat — models/chat.js
   Handles both DMs and group chats
   ============================================================ */

'use strict';

const mongoose              = require('mongoose');
const { generateInviteCode } = require('../utils/helpers');

const chatSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },

    // ── Group only ────────────────────────────────────────
    name: { type: String, trim: true, default: '' },
    icon: { type: String, default: '🚀' },

    // ── Invite link for groups ────────────────────────────
    // Only generated when admin requests it
    inviteCode: {
      type:   String,
      unique: true,
      sparse: true, // allows multiple nulls
      default: null,
    },

    inviteActive: {
      type:    Boolean,
      default: false, // invite link disabled until generated
    },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    admin: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    lastMessage: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Message',
      default: null,
    },

    unreadCounts: {
      type:    Map,
      of:      Number,
      default: {},
    },

    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

chatSchema.index({ members:   1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Chat', chatSchema);