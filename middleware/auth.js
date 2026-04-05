/* ============================================================
   TwatChat — middleware/auth.js
   Protects routes — verifies Bearer JWT and attaches user
   ============================================================ */

'use strict';

const User             = require('../models/user');
const { verifyToken }  = require('../services/token');

const protect = async (req, res, next) => {
  try {
    // ── Extract token from Authorization header ──────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorised, no token' });
    }

    const token = authHeader.split(' ')[1];

    // ── Verify token ─────────────────────────────────────
    const decoded = verifyToken(token); // throws if invalid/expired

    // ── Attach user to request (exclude password) ────────
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    // JsonWebTokenError + TokenExpiredError handled by error.js
    next(err);
  }
};

module.exports = { protect };