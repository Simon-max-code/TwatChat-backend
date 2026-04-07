'use strict';

const express  = require('express');
const router   = express.Router();
const { subscribe, unsubscribe, getVapidKey } = require('../controllers/pushCtrl');
const { protect } = require('../middleware/auth');

// Public — frontend needs this before auth to set up SW
router.get('/vapid-public-key', getVapidKey);

router.use(protect);
router.post('/subscribe',   subscribe);
router.delete('/unsubscribe', unsubscribe);

module.exports = router;