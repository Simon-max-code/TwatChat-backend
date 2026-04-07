/* ============================================================
   TwatChat — middleware/upload.js
   Multer middleware for handling file uploads
   ============================================================ */

'use strict';

const multer = require('multer');

// ── Store in memory — we stream directly to Cloudinary ────
const storage = multer.memoryStorage();

// ── File filter ────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  const allowed = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Videos
    'video/mp4',
    'video/mov',
    'video/webm',
    'video/quicktime',
    // Audio (voice notes)
    'audio/webm',
    'audio/ogg',
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/mp3',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported`), false);
  }
};

// ── Limits ─────────────────────────────────────────────────
const limits = {
  fileSize: 50 * 1024 * 1024, // 50MB max
};

const upload = multer({ storage, fileFilter, limits });

module.exports = upload;