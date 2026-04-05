/* ============================================================
   TwatChat — models/message.js
   ============================================================ */

'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    text: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Future: file/image attachments ────────────────────
    attachments: [
      {
        url:      { type: String },
        fileType: { type: String }, // image | video | file
        fileName: { type: String },
      },
    ],

    // ── Read receipts ─────────────────────────────────────
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ── Soft delete ───────────────────────────────────────
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true, // createdAt = message timestamp
  }
);

// ── Indexes for fast message queries ──────────────────────
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);