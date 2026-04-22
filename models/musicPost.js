/* ============================================================
   TwatChat — models/musicPost.js
   Supports both native uploads and shared Spotify tracks
   ============================================================ */

'use strict';

const mongoose = require('mongoose');

const musicPostSchema = new mongoose.Schema(
  {
    author: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // 'native' = user uploaded their own file
    // 'spotify' = user shared a Spotify track (preview only for non-premium)
    type: {
      type:    String,
      enum:    ['native', 'spotify'],
      default: 'native',
    },

    // ── Common fields ──────────────────────────────────────
    title:   { type: String, trim: true, required: true },
    artist:  { type: String, trim: true, default: '' },
    album:   { type: String, trim: true, default: '' },
    genre:   { type: String, trim: true, default: '' },
    caption: { type: String, trim: true, default: '' },
    coverUrl: { type: String, default: '' },    // album art or user-uploaded cover

    // Duration in seconds
    duration: { type: Number, default: 0 },

    // ── Native upload fields ───────────────────────────────
    audioUrl:      { type: String, default: '' },
    audioPublicId: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },

    // ── Spotify fields ─────────────────────────────────────
    spotifyId:  { type: String, default: '' },   // Spotify track ID
    spotifyUrl: { type: String, default: '' },   // Open in Spotify link
    previewUrl: { type: String, default: '' },   // 30s MP3 preview URL
    explicit:   { type: Boolean, default: false },

    // ── Engagement ─────────────────────────────────────────
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    plays:    { type: Number, default: 0 },
    comments: { type: Number, default: 0 },

    // ── Soft delete ────────────────────────────────────────
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

musicPostSchema.index({ createdAt: -1 });
musicPostSchema.index({ author: 1 });
musicPostSchema.index({ spotifyId: 1 });
musicPostSchema.index({ genre: 1 });

module.exports = mongoose.model('MusicPost', musicPostSchema);v 