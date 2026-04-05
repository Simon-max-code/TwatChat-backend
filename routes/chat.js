/* ============================================================
   TwatChat — routes/chat.js
   Chat routes + nested message routes
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
} = require('../controllers/chatCtrl');

const {
  sendMessage,
  getMessages,
  deleteMessage,
  clearChat,
} = require('../controllers/msgCtrl');

const { protect } = require('../middleware/auth');

// All routes protected
router.use(protect);

// ── Chat routes ────────────────────────────────────────────

// @POST   /api/chats               — create or fetch existing DM
router.post('/', createChat);

// @GET    /api/chats               — get all chats for current user
router.get('/', getChats);

// @POST   /api/chats/group         — create group chat
// NOTE: must be before /:id to avoid 'group' being treated as an id
router.post('/group', createGroup);

// @GET    /api/chats/:id           — get single chat
router.get('/:id', getChat);

// @DELETE /api/chats/:id           — delete DM
router.delete('/:id', deleteChat);

// @PUT    /api/chats/group/:id     — update group (admin only)
router.put('/group/:id', updateGroup);

// @DELETE /api/chats/group/:id/leave — leave group
router.delete('/group/:id/leave', leaveGroup);

// ── Message routes (nested under chat) ────────────────────

// @GET    /api/chats/:chatId/messages          — get messages (paginated)
router.get('/:chatId/messages', getMessages);

// @POST   /api/chats/:chatId/messages          — send message
router.post('/:chatId/messages', sendMessage);

// @DELETE /api/chats/:chatId/messages          — clear all messages
router.delete('/:chatId/messages', clearChat);

// @DELETE /api/chats/:chatId/messages/:msgId   — delete single message
router.delete('/:chatId/messages/:msgId', deleteMessage);

module.exports = router;