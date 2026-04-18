/* ============================================================
   TwatChat — controllers/postCtrl.js
   createPost | getPosts | deletePost | toggleLike
   ============================================================ */

'use strict';

const Post    = require('../models/post');
const User    = require('../models/user');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { getIO } = require('../config/socket');

// ── @POST /api/posts  (protected) ─────────────────────────
const createPost = async (req, res, next) => {
  try {
    let { type, text, caption, moodEmoji, moodLabel, moodSub, visibility } = req.body;

    // Validate type
    const VALID_TYPES = ['text', 'image', 'video', 'mood'];
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid post type' });
    }

    // Text posts need text
    if (type === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ message: 'Text is required for text posts' });
    }

    // Mood posts need emoji + label
    if (type === 'mood' && (!moodEmoji || !moodLabel)) {
      return res.status(400).json({ message: 'Mood emoji and label are required' });
    }

    // Media posts need a file
    if ((type === 'image' || type === 'video') && !req.file) {
      return res.status(400).json({ message: 'Media file is required for image/video posts' });
    }

    let mediaUrl      = '';
    let mediaPublicId = '';
    let thumbnailUrl  = '';
    let videoDuration = '';

    // ── Handle media upload ────────────────────────────────
    if (req.file) {
      const mime       = req.file.mimetype;
      const isVideo    = mime.startsWith('video/');
      const options    = {
        folder:        `twatchat/posts/${isVideo ? 'videos' : 'images'}`,
        resource_type: isVideo ? 'video' : 'image',
      };

      if (isVideo) {
        options.eager = [
          { width: 800, height: 600, crop: 'fill', format: 'jpg' }
        ];
      }

      const result   = await uploadToCloudinary(req.file.buffer, options);
      mediaUrl       = result.secure_url;
      mediaPublicId  = result.public_id;
      thumbnailUrl   = result.eager?.[0]?.secure_url || '';
      videoDuration  = result.duration
        ? formatDuration(result.duration)
        : '';
    }

    const post = await Post.create({
      author:        req.user._id,
      type,
      text:          text?.trim()    || '',
      caption:       caption?.trim() || '',
      moodEmoji:     moodEmoji       || '',
      moodLabel:     moodLabel?.trim() || '',
      moodSub:       moodSub?.trim() || '',
      mediaUrl,
      mediaPublicId,
      thumbnailUrl,
      videoDuration,
      visibility:    visibility || 'public',
    });

    const populated = await Post.findById(post._id)
      .populate('author', 'displayName initials avatarClass avatarUrl');

    // Broadcast new post to all connected clients
    try {
      const io = getIO();
      io.emit('post:new', { post: populated });
    } catch (_) {}

    res.status(201).json({ post: populated });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/posts  (protected) ──────────────────────────
// Query: ?tab=foryou|friends&page=1&limit=10
const getPosts = async (req, res, next) => {
  try {
    const { tab = 'foryou', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { deleted: false };

    if (tab === 'friends') {
      // For now — show posts from users who have chats with the current user
      // A full "follow" system can be added later
      const Chat = require('../models/chat');
      const chats = await Chat.find({ members: req.user._id, isGroup: false });
      const friendIds = [];
      chats.forEach(c => {
        c.members.forEach(m => {
          if (String(m) !== String(req.user._id)) friendIds.push(m);
        });
      });
      filter.author = { $in: friendIds };
    } else {
      // 'foryou' — public posts from everyone except hidden users
      const hiddenUsers = await User.find({ 'settings.hiddenMode': true }).select('_id');
      const hiddenIds   = hiddenUsers.map(u => u._id);
      if (hiddenIds.length) {
        filter.author = { $nin: hiddenIds };
      }
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'displayName initials avatarClass avatarUrl userCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Post.countDocuments(filter),
    ]);

    // Attach likedByMe flag
    const me = String(req.user._id);
    const postsWithMeta = posts.map(p => {
      const obj     = p.toObject();
      obj.likedByMe = p.likes.map(String).includes(me);
      obj.likeCount = p.likes.length;
      return obj;
    });

    res.json({
      posts: postsWithMeta,
      pagination: {
        page:    parseInt(page),
        limit:   parseInt(limit),
        total,
        pages:   Math.ceil(total / parseInt(limit)),
        hasMore: parseInt(page) * parseInt(limit) < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/posts/:id/like  (protected) ─────────────────
const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, deleted: false });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId  = String(req.user._id);
    const liked   = post.likes.map(String).includes(userId);

    if (liked) {
      post.likes.pull(req.user._id);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    const likeCount = post.likes.length;

    // Broadcast like update
    try {
      const io = getIO();
      io.emit('post:liked', {
        postId:    post._id,
        likeCount,
        likedByMe: !liked, // the new state
        userId,
      });
    } catch (_) {}

    res.json({
      liked:     !liked,
      likeCount,
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/posts/:id  (protected) ───────────────────
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, deleted: false });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorised to delete this post' });
    }

    // Delete media from Cloudinary
    if (post.mediaPublicId) {
      const resourceType = post.type === 'video' ? 'video' : 'image';
      await deleteFromCloudinary(post.mediaPublicId, resourceType).catch(() => {});
    }

    post.deleted = true;
    await post.save();

    // Broadcast deletion
    try {
      const io = getIO();
      io.emit('post:deleted', { postId: post._id });
    } catch (_) {}

    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Helper ─────────────────────────────────────────────────
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = { createPost, getPosts, toggleLike, deletePost };