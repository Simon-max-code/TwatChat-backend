// routes/user.js — replace existing file
'use strict';

const express = require('express');
const router  = express.Router();

const {
  getUsers,
  getUser,
  findByCode,
  updateProfile,
  updateUsername,
  deleteAccount,
} = require('../controllers/userCtrl');

const { protect } = require('../middleware/auth');
const upload      = require('../middleware/upload');

router.use(protect);

router.get('/',              getUsers);
router.get('/find/:code',    findByCode);
router.get('/:id',           getUser);

// ✅ Accept optional avatar file upload
router.put('/profile',   upload.single('avatar'), updateProfile);
router.put('/username',  updateUsername);
router.delete('/me',     deleteAccount);

module.exports = router;