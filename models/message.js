/* ============================================================
   TwatChat — models/message.js
   ============================================================ */

'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Chat',
      required: true,
    },

    sender: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // ── Text content (optional if attachment exists) ───────
    text: {
      type:    String,
      trim:    true,
      default: '',
    },

    // ── Media attachments ──────────────────────────────────
    attachments: [
      {
        url:          { type: String, required: true },
        publicId:     { type: String },               // Cloudinary public_id for deletion
        fileType:     { type: String, enum: ['image', 'video', 'audio'] },
        fileName:     { type: String, default: '' },
        mimeType:     { type: String, default: '' },
        size:         { type: Number, default: 0 },   // bytes
        duration:     { type: Number, default: 0 },   // seconds (audio/video)
        thumbnailUrl: { type: String, default: '' },  // video thumbnail
        width:        { type: Number, default: 0 },   // image/video dimensions
        height:       { type: Number, default: 0 },
      },
    ],

    // ── Read receipts ──────────────────────────────────────
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    // ── Soft delete ────────────────────────────────────────
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);