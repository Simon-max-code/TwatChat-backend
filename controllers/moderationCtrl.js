/* ============================================================
   TwatChat — controllers/moderationCtrl.js
   kickMember | muteMember | unmuteMember | banUser | unbanUser
   setMemberRole | resetInviteLink | toggleAnonymousMode
   ============================================================ */

'use strict';

const Chat    = require('../models/chat');
const Message = require('../models/message');
const { getIO } = require('../config/socket');
const { generateInviteCode } = require('../utils/helpers');

// ── Shared: load group + verify caller is admin/mod ────────
async function loadGroupAsAdminOrMod(chatId, callerId, requireAdmin = false) {
  const chat = await Chat.findOne({ _id: chatId, isGroup: true });
  if (!chat) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = requireAdmin
    ? chat.isAdmin(callerId)
    : chat.isAdminOrMod(callerId);

  if (!allowed) {
    const err = new Error('You do not have permission to do this');
    err.statusCode = 403;
    throw err;
  }

  return chat;
}

// ── @DELETE /api/chats/group/:id/members/:userId  (kick) ──
const kickMember = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id);

    // Cannot kick another admin
    if (chat.isAdmin(userId)) {
      return res.status(403).json({ message: 'Cannot kick an admin' });
    }

    // Remove from members
    chat.members = chat.members.filter(m => String(m) !== userId);

    // Remove their role entry
    chat.memberRoles = chat.memberRoles.filter(r => String(r.user) !== userId);

    // Remove mute record if any
    chat.mutedMembers = chat.mutedMembers.filter(m => String(m.user) !== userId);

  await chat.save();

    // Notify the room in real-time
    try {
      const io = getIO();
      io.to(chatId).emit('moderation:kicked', { userId, chatId });
      // Force the kicked user off the room via their personal room
      io.to(userId).emit('moderation:you_were_kicked', { chatId, chatName: chat.name });
    } catch (_) {}

    res.json({ message: 'Member kicked successfully' });

  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/group/:id/mute/:userId ───────────────
// Body: { durationMinutes: number | null }
// durationMinutes = null  →  muted indefinitely
const muteMember = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    const { durationMinutes = null } = req.body;
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id);

    // Cannot mute another admin
    if (chat.isAdmin(userId)) {
      return res.status(403).json({ message: 'Cannot mute an admin' });
    }

    // Must be a member
    const isMember = chat.members.some(m => String(m) === userId);
    if (!isMember) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    // Calculate unmuteAt
    let unmuteAt = null;
    if (durationMinutes && durationMinutes > 0) {
      unmuteAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }

    // Upsert mute record
    const existingIdx = chat.mutedMembers.findIndex(m => String(m.user) === userId);
    const muteRecord  = { user: userId, mutedAt: new Date(), unmuteAt, mutedBy: req.user._id };

    if (existingIdx >= 0) {
      chat.mutedMembers[existingIdx] = muteRecord;
    } else {
      chat.mutedMembers.push(muteRecord);
    }

   await chat.save();

    try {
      const io = getIO();
      io.to(chatId).emit('moderation:muted', { userId, unmuteAt, chatId });
      io.to(userId).emit('moderation:you_were_muted', {
        chatId, chatName: chat.name, unmuteAt,
        message: `You have been muted ${durationMinutes ? `for ${durationMinutes} minutes` : 'indefinitely'}`,
      });
    } catch (_) {}

    const label = durationMinutes
      ? `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`
      : 'indefinitely';

    res.json({
      message:  `Member muted ${label}`,
      unmuteAt,
      mutedBy:  req.user._id,
    });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/group/:id/mute/:userId  (unmute) ───
const unmuteMember = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id);

    const before = chat.mutedMembers.length;
    chat.mutedMembers = chat.mutedMembers.filter(m => String(m.user) !== userId);

    if (chat.mutedMembers.length === before) {
      return res.status(404).json({ message: 'User is not muted' });
    }

   await chat.save();

try {
  const io = getIO();
  io.to(chatId).emit('moderation:unmuted', { userId, chatId });       
  io.to(userId).emit('moderation:you_were_unmuted', {             
    chatName: chat.name,
    message: 'You have been unmuted',
  });
} catch (_) {}
    res.json({ message: 'Member unmuted' });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/group/:id/ban/:userId ────────────────
const banUser = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    // Only full admins can ban
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id, true);

    if (chat.isAdmin(userId)) {
      return res.status(403).json({ message: 'Cannot ban an admin' });
    }

    // Add to banned list (idempotent)
    const alreadyBanned = chat.bannedUsers.some(u => String(u) === userId);
    if (!alreadyBanned) {
      chat.bannedUsers.push(userId);
    }

    // Also kick from members if present
    chat.members     = chat.members.filter(m => String(m) !== userId);
    chat.memberRoles = chat.memberRoles.filter(r => String(r.user) !== userId);
    chat.mutedMembers = chat.mutedMembers.filter(m => String(m.user) !== userId);
await chat.save();

    try {
      const io = getIO();
      io.to(chatId).emit('moderation:banned', { userId, chatId });
      io.to(userId).emit('moderation:you_were_banned', { chatId, chatName: chat.name });
    } catch (_) {}
    
    res.json({ message: 'User banned from this group' });
  } catch (err) {
    next(err);
  }
};

// ── @DELETE /api/chats/group/:id/ban/:userId  (unban) ─────
const unbanUser = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id, true);

    const before = chat.bannedUsers.length;
    chat.bannedUsers = chat.bannedUsers.filter(u => String(u) !== userId);

    if (chat.bannedUsers.length === before) {
      return res.status(404).json({ message: 'User is not banned' });
    }

    await chat.save();
    res.json({ message: 'User unbanned' });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/chats/group/:id/role/:userId ────────────────
// Body: { role: 'member' | 'moderator' | 'admin' }
const setMemberRole = async (req, res, next) => {
  try {
    const { id: chatId, userId } = req.params;
    const { role } = req.body;

    if (!['member', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Use: member, moderator, admin' });
    }

    // Only full admins can promote/demote
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id, true);

    // Target must be a member
    const isMember = chat.members.some(m => String(m) === userId);
    if (!isMember) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    // Upsert role entry
    const existingIdx = chat.memberRoles.findIndex(r => String(r.user) === userId);
    if (existingIdx >= 0) {
      chat.memberRoles[existingIdx].role = role;
    } else {
      chat.memberRoles.push({ user: userId, role });
    }

    // If promoting to admin, also set the legacy admin field
    // (only if the original admin is setting a NEW admin and stepping down)
    if (role === 'admin' && String(chat.admin) === String(req.user._id)) {
      chat.admin = userId;
    }

    await chat.save();
    res.json({ message: `Role updated to "${role}"`, userId, role });
  } catch (err) {
    next(err);
  }
};

// ── @POST /api/chats/group/:id/invite/reset ───────────────
// Generates a brand-new invite code, invalidating the old one
const resetInviteLink = async (req, res, next) => {
  try {
    const { id: chatId } = req.params;
    // Only full admins can reset the link
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id, true);

    chat.inviteCode   = generateInviteCode();
    chat.inviteActive = true;
    await chat.save();

    res.json({
      message:    'Invite link reset successfully',
      inviteCode: chat.inviteCode,
      inviteLink: `${process.env.CLIENT_URL || 'https://twat-chat.vercel.app'}?join=${chat.inviteCode}`,
    });
  } catch (err) {
    next(err);
  }
};

// ── @PUT /api/chats/group/:id/anonymous ──────────────────
// Body: { enabled: boolean }
const toggleAnonymousMode = async (req, res, next) => {
  try {
    const { id: chatId } = req.params;
    const { enabled }    = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: '`enabled` must be a boolean' });
    }

    // Only full admins can toggle anonymous mode
    const chat = await loadGroupAsAdminOrMod(chatId, req.user._id, true);

    chat.anonymousMode = enabled;
    
await chat.save();

    try {
      const io = getIO();
      io.to(chatId).emit('moderation:anonymous_mode', {
        chatId,
        anonymousMode: chat.anonymousMode,
      });
    } catch (_) {}

    res.json({
      message:       `Anonymous mode ${enabled ? 'enabled' : 'disabled'}`,
      anonymousMode: chat.anonymousMode,
    });
  } catch (err) {
    next(err);
  }
};

// ── @GET /api/chats/group/:id/moderation ─────────────────
// Returns full moderation state for the admin panel
const getModerationInfo = async (req, res, next) => {
  try {
    const { id: chatId } = req.params;
    const chat = await Chat.findOne({ _id: chatId, isGroup: true })
      .populate('mutedMembers.user',  'displayName initials avatarClass userCode')
      .populate('mutedMembers.mutedBy', 'displayName')
      .populate('bannedUsers',          'displayName initials avatarClass userCode')
      .populate('memberRoles.user',     'displayName initials avatarClass');

    if (!chat) return res.status(404).json({ message: 'Group not found' });

    if (!chat.isAdminOrMod(req.user._id)) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    // Filter out expired mutes before responding
    const now = new Date();
    const activeMutes = (chat.mutedMembers || []).filter(m => {
      if (!m.unmuteAt) return true;          // indefinite
      return new Date(m.unmuteAt) > now;     // not yet expired
    });

    res.json({
      anonymousMode: chat.anonymousMode,
      mutedMembers:  activeMutes,
      bannedUsers:   chat.bannedUsers,
      memberRoles:   chat.memberRoles,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  kickMember,
  muteMember,
  unmuteMember,
  banUser,
  unbanUser,
  setMemberRole,
  resetInviteLink,
  toggleAnonymousMode,
  getModerationInfo,
};