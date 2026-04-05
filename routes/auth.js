/* ============================================================
   TwatChat — routes/auth.js
   ============================================================ */

'use strict';

const express  = require('express');
const router   = express.Router();

const { register, login, getMe, updatePassword } = require('../controllers/authCTRL');
const { protect } = require('../middleware/auth');

// @POST  /api/auth/register  — public
router.post('/register', register);

// @POST  /api/auth/login     — public
router.post('/login', login);

// @GET   /api/auth/me        — protected
router.get('/me', protect, getMe);

// @PUT   /api/auth/password  — protected
router.put('/password', protect, updatePassword);

module.exports = router;