/* ============================================================
   TwatChat — routes/chat.js
   Chat + Message + Invite routes
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();

const {
  createChat,
  getChats,
  getChat,
  createGroup,
  updateGroup,
  leaveGroup,
  deleteChat,
  generateInvite,
  joinByInvite,
} = require('../controllers/chatCtrl');

const {
  sendMessage,
  getMessages,
  deleteMessage,
  clearChat,
} = require('../controllers/msgCtrl');

const { protect } = require('../middleware/auth');

router.use(protect);

// ── Chat routes ────────────────────────────────────────────

// @POST   /api/chats                      — create or fetch DM
router.post('/', createChat);

// @GET    /api/chats                      — all chats for user
router.get('/', getChats);

// @POST   /api/chats/group               — create group
// NOTE: before /:id
router.post('/group', createGroup);

// @POST   /api/chats/join/:inviteCode    — join group via invite
router.post('/join/:inviteCode', joinByInvite);

// @GET    /api/chats/:id                 — single chat
router.get('/:id', getChat);

// @DELETE /api/chats/:id                 — delete DM
router.delete('/:id', deleteChat);

// @PUT    /api/chats/group/:id           — update group (admin)
router.put('/group/:id', updateGroup);

// @DELETE /api/chats/group/:id/leave     — leave group
router.delete('/group/:id/leave', leaveGroup);

// @POST   /api/chats/group/:id/invite    — generate invite link (admin)
router.post('/group/:id/invite', generateInvite);

// ── Message routes ─────────────────────────────────────────

// @GET    /api/chats/:chatId/messages    — get messages (paginated)
router.get('/:chatId/messages', getMessages);

// @POST   /api/chats/:chatId/messages    — send message
router.post('/:chatId/messages', sendMessage);

// @DELETE /api/chats/:chatId/messages    — clear all messages
router.delete('/:chatId/messages', clearChat);

// @DELETE /api/chats/:chatId/messages/:msgId — delete single message
router.delete('/:chatId/messages/:msgId', deleteMessage);

module.exports = router;