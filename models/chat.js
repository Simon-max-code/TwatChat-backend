/* ============================================================
   TwatChat — models/chat.js
   Handles both DMs and group chats
   ============================================================ */

'use strict';

const mongoose               = require('mongoose');
const { generateInviteCode } = require('../utils/helpers');

// ── Muted member sub-schema ────────────────────────────────
const mutedMemberSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mutedAt:  { type: Date, default: Date.now },
    unmuteAt: { type: Date, default: null }, // null = indefinite
    mutedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// ── Member role sub-schema ─────────────────────────────────
const memberRoleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type:    String,
      enum:    ['member', 'moderator', 'admin'],
      default: 'member',
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },

    // ── Group only ────────────────────────────────────────
    name: { type: String, trim: true, default: '' },
    icon: { type: String, default: '🚀' },

    // ── Invite link ───────────────────────────────────────
    inviteCode:   { type: String, unique: true, sparse: true },
    inviteActive: { type: Boolean, default: false },

    // ── Members & roles ───────────────────────────────────
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Original single-admin field kept for backward compat
    admin: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // Rich per-member role tracking
    memberRoles: [memberRoleSchema],

    // ── Moderation ────────────────────────────────────────
    mutedMembers: [mutedMemberSchema],
    bannedUsers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Anonymous mode ────────────────────────────────────
    anonymousMode: { type: Boolean, default: false },

    // ── Legacy notification-mute (kept for compat) ────────
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    lastMessage: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Message',
      default: null,
    },

    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

chatSchema.index({ members:   1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ inviteCode: 1 });

// ── Instance helpers ──────────────────────────────────────

// Returns true if userId is the original admin OR has admin/moderator role
chatSchema.methods.isAdminOrMod = function (userId) {
  const id = String(userId);
  if (String(this.admin) === id) return true;
  const entry = this.memberRoles.find(r => String(r.user) === id);
  return !!(entry && ['admin', 'moderator'].includes(entry.role));
};

// Returns true only for full admins
chatSchema.methods.isAdmin = function (userId) {
  const id = String(userId);
  if (String(this.admin) === id) return true;
  const entry = this.memberRoles.find(r => String(r.user) === id);
  return !!(entry && entry.role === 'admin');
};

// Returns the active mute record for a user (null if not muted / expired)
chatSchema.methods.getMuteRecord = function (userId) {
  const id  = String(userId);
  const rec = this.mutedMembers.find(m => String(m.user) === id);
  if (!rec) return null;
  // Auto-expire check
  if (rec.unmuteAt && new Date(rec.unmuteAt) <= new Date()) return null;
  return rec;
};

module.exports = mongoose.model('Chat', chatSchema);