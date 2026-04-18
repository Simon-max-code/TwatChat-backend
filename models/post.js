'use strict';

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Type: 'text' | 'image' | 'video' | 'live' | 'mood'
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'live', 'mood'],
      required: true,
      default: 'text',
    },

    // Text content
    text: { type: String, trim: true, default: '' },

    // Media
    mediaUrl:    { type: String, default: '' },
    mediaPublicId: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    videoDuration: { type: String, default: '' },

    // Caption (for image/video posts)
    caption: { type: String, trim: true, default: '' },

    // Mood-specific
    moodEmoji: { type: String, default: '' },
    moodLabel: { type: String, default: '' },
    moodSub:   { type: String, default: '' },

    // Live-specific
    isLive:   { type: Boolean, default: false },
    viewers:  { type: Number, default: 0 },

    // Engagement
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: { type: Number, default: 0 }, // count only for now

    // Visibility
    visibility: {
      type: String,
      enum: ['public', 'friends'],
      default: 'public',
    },

    // Soft delete
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1 });
postSchema.index({ type: 1 });

module.exports = mongoose.model('Post', postSchema);