/* ============================================================
   TwatChat — routes/moderation.js
   All group moderation endpoints (admin/mod only)
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true }); // ← mergeParams to get :id from parent

const {
  kickMember,
  muteMember,
  unmuteMember,
  banUser,
  unbanUser,
  setMemberRole,
  resetInviteLink,
  toggleAnonymousMode,
  getModerationInfo,
} = require('../controllers/moderationCtrl');

const { protect } = require('../middleware/auth');

router.use(protect);

// GET  /api/chats/group/:id/moderation          — full mod info
router.get('/',                         getModerationInfo);

// DELETE /api/chats/group/:id/members/:userId   — kick
router.delete('/members/:userId',       kickMember);

// POST   /api/chats/group/:id/mute/:userId      — mute
router.post('/mute/:userId',            muteMember);

// DELETE /api/chats/group/:id/mute/:userId      — unmute
router.delete('/mute/:userId',          unmuteMember);

// POST   /api/chats/group/:id/ban/:userId       — ban
router.post('/ban/:userId',             banUser);

// DELETE /api/chats/group/:id/ban/:userId       — unban
router.delete('/ban/:userId',           unbanUser);

// PUT    /api/chats/group/:id/role/:userId      — set role
router.put('/role/:userId',             setMemberRole);

// POST   /api/chats/group/:id/invite/reset      — reset invite link
router.post('/invite/reset',            resetInviteLink);

// PUT    /api/chats/group/:id/anonymous         — toggle anon mode
router.put('/anonymous',                toggleAnonymousMode);

module.exports = router;