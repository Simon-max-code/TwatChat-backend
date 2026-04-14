'use strict';

const express = require('express');
const router  = express.Router();

const {
  createChat, getChats, getChat, createGroup,
  updateGroup, leaveGroup, deleteChat,
  generateInvite, joinByInvite,
} = require('../controllers/chatCtrl');

const { sendMessage, sendMedia, getMessages, deleteMessage, clearChat } = require('../controllers/msgCtrl');
const { protect }          = require('../middleware/auth');
const upload               = require('../middleware/upload');
const moderationRouter     = require('./moderation');

router.use(protect);

// ── Chat routes ────────────────────────────────────────────
router.post('/',                            createChat);
router.get('/',                             getChats);
router.post('/group',                       createGroup);
router.post('/join/:inviteCode',            joinByInvite);
router.get('/:id',                          getChat);
router.delete('/:id',                       deleteChat);
router.put('/group/:id',                    updateGroup);
router.delete('/group/:id/leave',           leaveGroup);
router.post('/group/:id/invite',            generateInvite);

// ── Message routes ─────────────────────────────────────────
router.get('/:chatId/messages',             getMessages);
router.post('/:chatId/messages',            sendMessage);
router.delete('/:chatId/messages',          clearChat);
router.delete('/:chatId/messages/:msgId',   deleteMessage);
router.post('/:chatId/messages/media',      upload.single('file'), sendMedia);

// ── Moderation routes (admin/mod only) ────────────────────
router.use('/group/:id/moderation',         moderationRouter);

module.exports = router;