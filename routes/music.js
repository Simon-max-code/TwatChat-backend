/* ============================================================
   TwatChat — routes/music.js
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const {
  search,
  recommendations,
  genres,
  getOne,
  postSong,
  shareSpotifyTrack,
  getFeed,
  toggleLike,
  deleteSong,
} = require('../controllers/musicCtrl');

const { protect } = require('../middleware/auth');

// ── Memory storage for audio + cover uploads ──────────────
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac',
    'image/jpeg', 'image/png', 'image/webp',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type ${file.mimetype} not allowed`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── Spotify discovery (public-ish — just needs auth) ──────
router.use(protect);

// GET  /api/music/search?q=billie+eilish
router.get('/search',          search);

// GET  /api/music/recommendations?genres=pop,r-n-b&seeds=trackId1,trackId2
router.get('/recommendations', recommendations);

// GET  /api/music/genres
router.get('/genres',          genres);

// GET  /api/music/track/:spotifyId
router.get('/track/:spotifyId', getOne);

// ── Feed ──────────────────────────────────────────────────
// GET  /api/music/posts?tab=foryou&page=1
router.get('/posts',           getFeed);

// PUT  /api/music/posts/:id/like
router.put('/posts/:id/like',  toggleLike);

// DELETE /api/music/posts/:id
router.delete('/posts/:id',    deleteSong);

// ── Create posts ──────────────────────────────────────────
// POST /api/music/posts  (native upload — multipart/form-data)
// Fields: title, artist, genre, caption + files: audio, cover
router.post(
  '/posts',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  postSong
);

// POST /api/music/posts/spotify  (share a Spotify track)
// Body: { spotifyId, caption }
router.post('/posts/spotify',  shareSpotifyTrack);

module.exports = router;