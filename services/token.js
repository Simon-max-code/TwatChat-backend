/* ============================================================
   TwatChat — services/token.js
   JWT generation + verification
   ============================================================ */

'use strict';

const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

// ── Generate a signed JWT ──────────────────────────────────
const generateToken = (userId) => {
  if (!SECRET) throw new Error('JWT_SECRET is not defined');

  return jwt.sign(
    { id: userId },
    SECRET,
    { expiresIn: EXPIRES }
  );
};

// ── Verify a JWT and return the decoded payload ────────────
const verifyToken = (token) => {
  if (!SECRET) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, SECRET); // throws JsonWebTokenError / TokenExpiredError
};

module.exports = { generateToken, verifyToken };