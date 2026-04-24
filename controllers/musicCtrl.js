/* ============================================================
   TwatChat — controllers/musicCtrl.js
   search | recommendations | genres | postSong | getFeed | deleteSong | toggleLike
   ============================================================ */

'use strict';

const { searchTracks, getTrack, getRecommendations, getGenres } = require('../services/spotify');
const MusicPost = require('../models/musicPost');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { getIO } = require('../config/socket');

// ── @GET /api/music/search?q=&limit= ──────────────────────
const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit, 10) || 20;

    if (!q || !q.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const tracks = await searchTracks(q.trim(), limit);
    res.json({ tracks });
  } catch (err) {
    // Surface Spotify errors clearly instead of generic 500
    console.error('Music search error:', err.message);
    next(err);
  }
};

// ── @GET /api/music/recommendations?genres=&seeds= ────────
const recommendations = async (req, res, next) => {
  try {
    const { genres = '', seeds = '', limit = 20 } = req.query;

    const seedGenres = genres ? genres.split(',').map(g => g.trim()).filter(Boolean) : [];
    const seedTracks = seeds  ? seeds.split(',').map(s => s.trim()).filter(Boolean)  : [];

    const tracks = await getRecommendations({
      seedGenres,
      seedTracks,
      limit,
    });

    res.json({ tracks });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/music/genres ─────────────────────────────────
const genres = async (req, res, next) => {
  try {
    const list = await getGenres();
    res.json({ genres: list });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/music/track/:spotifyId ──────────────────────
const getOne = async (req, res, next) => {
  try {
    const track = await getTrack(req.params.spotifyId);
    if (!track) return res.status(404).json({ message: 'Track not found' });
    res.json({ track });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/music/posts  (native upload) ───────────────
// User shares their own audio file to the music feed
const postSong = async (req, res, next) => {
  try {
    const { title, artist, genre, caption } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Song title is required' });
    }

    // ── Handle audio file upload ───────────────────────────
    let audioUrl      = '';
    let audioPublicId = '';
    let coverUrl      = '';
    let coverPublicId = '';
    let duration      = 0;

    if (req.files?.audio?.[0]) {
      const audioFile = req.files.audio[0];
      const result    = await uploadToCloudinary(audioFile.buffer, {
        folder:        'twatchat/music/audio',
        resource_type: 'video', // Cloudinary uses 'video' for audio files
      });
      audioUrl      = result.secure_url;
      audioPublicId = result.public_id;
      duration      = result.duration || 0;
    }

    if (req.files?.cover?.[0]) {
      const coverFile = req.files.cover[0];
      const result    = await uploadToCloudinary(coverFile.buffer, {
        folder:        'twatchat/music/covers',
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'center' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });
      coverUrl      = result.secure_url;
      coverPublicId = result.public_id;
    }

    const post = await MusicPost.create({
      author:       req.user._id,
      type:         'native',
      title:        title.trim(),
      artist:       artist?.trim() || req.user.displayName,
      genre:        genre?.trim()  || '',
      caption:      caption?.trim() || '',
      audioUrl,
      audioPublicId,
      coverUrl,
      coverPublicId,
      duration,
    });

    const populated = await MusicPost.findById(post._id)
      .populate('author', 'displayName initials avatarClass avatarUrl');

    // Broadcast to all connected clients
    try {
      const io = getIO();
      io.emit('music:new', { post: populated });
    } catch (_) {}

    res.status(201).json({ post: populated });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/music/posts/spotify  (share Spotify track) ─
// User shares a Spotify track to the TwatChat music feed
const shareSpotifyTrack = async (req, res, next) => {
  try {
    const { spotifyId, caption } = req.body;

    if (!spotifyId) {
      return res.status(400).json({ message: 'Spotify track ID is required' });
    }

    // Fetch track metadata from Spotify
    const track = await getTrack(spotifyId);
    if (!track) return res.status(404).json({ message: 'Track not found on Spotify' });

    // Check if already shared (avoid duplicates in feed)
    const existing = await MusicPost.findOne({
      spotifyId,
      author: req.user._id,
      deleted: false,
    });

    if (existing) {
      return res.status(409).json({ message: 'You already shared this track' });
    }

    const post = await MusicPost.create({
      author:      req.user._id,
      type:        'spotify',
      title:       track.title,
      artist:      track.artist,
      album:       track.album,
      genre:       '',
      caption:     caption?.trim() || '',
      spotifyId:   track.spotifyId,
      spotifyUrl:  track.spotifyUrl,
      previewUrl:  track.previewUrl,  // 30s MP3
      coverUrl:    track.albumArt,
      duration:    track.durationMs ? track.durationMs / 1000 : 0,
      explicit:    track.explicit,
    });

    const populated = await MusicPost.findById(post._id)
      .populate('author', 'displayName initials avatarClass avatarUrl');

    try {
      const io = getIO();
      io.emit('music:new', { post: populated });
    } catch (_) {}

    res.status(201).json({ post: populated });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/music/posts  (feed) ─────────────────────────
const getFeed = async (req, res, next) => {
  try {
    const { tab = 'foryou', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { deleted: false };

    if (tab === 'friends') {
      const Chat = require('../models/chat');
      const chats = await Chat.find({ members: req.user._id, isGroup: false });
      const friendIds = [];
      chats.forEach(c => {
        c.members.forEach(m => {
          if (String(m) !== String(req.user._id)) friendIds.push(m);
        });
      });
      friendIds.push(req.user._id);
      filter.author = { $in: friendIds };
    }

    const [posts, total] = await Promise.all([
      MusicPost.find(filter)
        .populate('author', 'displayName initials avatarClass avatarUrl userCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MusicPost.countDocuments(filter),
    ]);

    const me = String(req.user._id);
    const postsWithMeta = posts.map(p => {
      const obj      = p.toObject();
      obj.likedByMe  = p.likes.map(String).includes(me);
      obj.likeCount  = p.likes.length;
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

// ── @PUT /api/music/posts/:id/like ────────────────────────
const toggleLike = async (req, res, next) => {
  try {
    const post = await MusicPost.findOne({ _id: req.params.id, deleted: false });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = String(req.user._id);
    const liked  = post.likes.map(String).includes(userId);

    if (liked) post.likes.pull(req.user._id);
    else       post.likes.push(req.user._id);

    await post.save();

    const likeCount = post.likes.length;

    try {
      const io = getIO();
      io.emit('music:liked', {
        postId: post._id,
        likeCount,
        likedByMe: !liked,
        userId,
      });
    } catch (_) {}

    res.json({ liked: !liked, likeCount });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/music/posts/:id ──────────────────────────
const deleteSong = async (req, res, next) => {
  try {
    const post = await MusicPost.findOne({ _id: req.params.id, deleted: false });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    // Clean up Cloudinary assets for native uploads
    if (post.audioPublicId) {
      await deleteFromCloudinary(post.audioPublicId, 'video').catch(() => {});
    }
    if (post.coverPublicId) {
      await deleteFromCloudinary(post.coverPublicId, 'image').catch(() => {});
    }

    post.deleted = true;
    await post.save();

    try {
      const io = getIO();
      io.emit('music:deleted', { postId: post._id });
    } catch (_) {}

    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  search,
  recommendations,
  genres,
  getOne,
  postSong,
  shareSpotifyTrack,
  getFeed,
  toggleLike,
  deleteSong,
};