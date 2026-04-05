/* ============================================================
   TwatChat — middleware/error.js
   Global error handler — must be last middleware in server.js
   ============================================================ */

'use strict';

const errorHandler = (err, _req, res, _next) => {
  // Log full error in dev, minimal in prod
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', err);
  } else {
    console.error(`❌ Error: ${err.message}`);
  }

  // ── Mongoose: bad ObjectId ─────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  // ── Mongoose: duplicate key (e.g. email already exists) ─
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`,
    });
  }

  // ── Mongoose: validation error ───────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  // ── JWT: invalid token ─────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // ── JWT: expired token ─────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired, please log in again' });
  }

  // ── CORS error ─────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ message: err.message });
  }

  // ── Default: use status attached to error or 500 ───────
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    message,
    // Only expose stack trace in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;