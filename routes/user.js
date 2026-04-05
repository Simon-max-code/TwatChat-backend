/* ============================================================
   TwatChat — routes/user.js
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();

const {
  getUsers,
  getUser,
  findByCode,
  updateProfile,
  deleteAccount,
} = require('../controllers/userCtrl');

const { protect } = require('../middleware/auth');

router.use(protect);

// @GET    /api/users               — all users (supports ?search=)
router.get('/', getUsers);

// @GET    /api/users/find/:code    — find user by TC-XXXX-XX code
// NOTE: must be before /:id so "find" isn't treated as an id
router.get('/find/:code', findByCode);

// @GET    /api/users/:id           — get single user
router.get('/:id', getUser);

// @PUT    /api/users/profile       — update own profile
router.put('/profile', updateProfile);

// @DELETE /api/users/me            — delete own account
router.delete('/me', deleteAccount);

module.exports = router;