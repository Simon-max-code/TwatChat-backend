/* ============================================================
   TwatChat — utils/response.js
   Standardised API response helpers
   ============================================================ */

'use strict';

// ── 200 OK ─────────────────────────────────────────────────
const ok = (res, data = {}, message = 'Success') => {
  return res.status(200).json({ success: true, message, ...data });
};

// ── 201 Created ────────────────────────────────────────────
const created = (res, data = {}, message = 'Created successfully') => {
  return res.status(201).json({ success: true, message, ...data });
};

// ── 400 Bad Request ────────────────────────────────────────
const badRequest = (res, message = 'Bad request') => {
  return res.status(400).json({ success: false, message });
};

// ── 401 Unauthorised ───────────────────────────────────────
const unauthorised = (res, message = 'Not authorised') => {
  return res.status(401).json({ success: false, message });
};

// ── 403 Forbidden ──────────────────────────────────────────
const forbidden = (res, message = 'Forbidden') => {
  return res.status(403).json({ success: false, message });
};

// ── 404 Not Found ──────────────────────────────────────────
const notFound = (res, message = 'Not found') => {
  return res.status(404).json({ success: false, message });
};

// ── 409 Conflict ───────────────────────────────────────────
const conflict = (res, message = 'Conflict') => {
  return res.status(409).json({ success: false, message });
};

// ── 500 Server Error ───────────────────────────────────────
const serverError = (res, message = 'Internal server error') => {
  return res.status(500).json({ success: false, message });
};

module.exports = {
  ok,
  created,
  badRequest,
  unauthorised,
  forbidden,
  notFound,
  conflict,
  serverError,
};