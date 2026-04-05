/* ============================================================
   TwatChat — routes/user.js
   ============================================================ */

'use strict';

const express  = require('express');
const router   = express.Router();

const {
  getUsers,
  getUser,
  updateProfile,
  deleteAccount,
} = require('../controllers/userCtrl');

const { protect } = require('../middleware/auth');

// All user routes are protected
router.use(protect);

// @GET    /api/users          — get all users (supports ?search=)
router.get('/', getUsers);

// @GET    /api/users/:id      — get single user by id
router.get('/:id', getUser);

// @PUT    /api/users/profile  — update own profile
router.put('/profile', updateProfile);

// @DELETE /api/users/me       — delete own account
router.delete('/me', deleteAccount);

module.exports = router;