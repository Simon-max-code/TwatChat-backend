'use strict';

const express    = require('express');
const router     = express.Router();
const { createPost, getPosts, toggleLike, deletePost } = require('../controllers/postCtrl');
const { protect } = require('../middleware/auth');
const upload     = require('../middleware/upload');

router.use(protect);

// GET  /api/posts?tab=foryou&page=1    — feed
router.get('/',             getPosts);

// POST /api/posts                      — create (with optional media)
router.post('/', upload.single('media'), createPost);

// PUT  /api/posts/:id/like             — toggle like
router.put('/:id/like',     toggleLike);

// DELETE /api/posts/:id                — delete own post
router.delete('/:id',       deletePost);

module.exports = router;