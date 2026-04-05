/* ============================================================
   TwatChat — utils/helpers.js
   Reusable utility functions
   ============================================================ */

'use strict';

const crypto = require('crypto');

// ── Generate unique user code e.g. "TC-4829-XK" ───────────
const generateUserCode = () => {
  const digits  = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const letters = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 2); // 2 letters
  return `TC-${digits}-${letters}`;
};

// ── Generate chatroom invite code e.g. "inv_a3f8c2d1e4" ───
const generateInviteCode = () => {
  return 'inv_' + crypto.randomBytes(6).toString('hex');
};

// ── Generate initials from name ────────────────────────────
const getInitials = (firstName = '', lastName = '') => {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f)      return f.slice(0, 2).toUpperCase();
  return 'U';
};

// ── Generate display name ──────────────────────────────────
const getDisplayName = (firstName = '', lastName = '', email = '') => {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return `${f} ${l}`;
  if (f)      return f;
  return email.split('@')[0] || 'User';
};

// ── Sanitise a string — strip HTML tags ───────────────────
const sanitise = (str = '') => {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

// ── Paginate a Mongoose query ──────────────────────────────
const paginate = (query = {}) => {
  const page  = Math.max(parseInt(query.page)  || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 40, 100);
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// ── Build pagination meta ──────────────────────────────────
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages:   Math.ceil(total / limit),
  hasMore: page * limit < total,
});

// ── Pick only allowed keys ─────────────────────────────────
const pick = (obj = {}, keys = []) => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

// ── Check valid MongoDB ObjectId ──────────────────────────
const isValidObjectId = (id) => {
  return /^[a-f\d]{24}$/i.test(id);
};

// ── Format lastSeen ────────────────────────────────────────
const formatLastSeen = (date) => {
  if (!date) return 'a while ago';
  const now     = Date.now();
  const diff    = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours   < 24) return `${hours}h ago`;
  if (days    < 7)  return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

module.exports = {
  generateUserCode,
  generateInviteCode,
  getInitials,
  getDisplayName,
  sanitise,
  paginate,
  paginationMeta,
  pick,
  isValidObjectId,
  formatLastSeen,
};