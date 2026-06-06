'use strict';

const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const User     = require('../models/user');
const { protect } = require('../middleware/auth');
const { exchangeCode, getNowPlaying } = require('../services/spotifyAuth');

const SCOPES = 'user-read-currently-playing user-read-playback-state';

// GET /api/spotify/auth-url  — returns the Spotify login URL
router.get('/auth-url', protect, (_req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.SPOTIFY_CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  process.env.SPOTIFY_REDIRECT_URI,
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

// GET /api/spotify/callback  — Spotify redirects here after auth
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error || !code || !state) {
    return res.redirect(`${process.env.CLIENT_URL}/settings?spotify=error`);
  }

  try {
    const tokens = await exchangeCode(code);

    const { data: profile } = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    await User.findByIdAndUpdate(state, {
      'spotify.accessToken':  tokens.access_token,
      'spotify.refreshToken': tokens.refresh_token,
      'spotify.expiresAt':    Date.now() + tokens.expires_in * 1000,
      'spotify.spotifyId':    profile.id,
      'spotify.connected':    true,
    });

    res.redirect(`${process.env.CLIENT_URL}/?spotifyConnected=1`);
  } catch (err) {
    console.error('[Spotify callback]', err.message);
    res.redirect(`${process.env.CLIENT_URL}/?spotify=error`);
  }
});

// GET /api/spotify/auth-url-with-state  — includes userId as state
router.get('/auth-url-with-state', protect, (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.SPOTIFY_CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  process.env.SPOTIFY_REDIRECT_URI,
    state:         String(req.user._id),
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

// DELETE /api/spotify/disconnect
router.delete('/disconnect', protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    'spotify.accessToken':  '',
    'spotify.refreshToken': '',
    'spotify.connected':    false,
    'spotify.spotifyId':    '',
  });
  res.json({ message: 'Spotify disconnected' });
});

// GET /api/spotify/status  — is this user connected?
router.get('/status', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('spotify');
  res.json({ connected: !!user?.spotify?.connected });
});

// GET /api/spotify/now-playing  — current user's now playing
router.get('/now-playing', protect, async (req, res) => {
  const track = await getNowPlaying(req.user._id);
  res.json({ track });
});

// PUT /api/spotify/share-toggle  — opt in/out of sharing
router.put('/share-toggle', protect, async (req, res) => {
  const { share } = req.body;
  await User.findByIdAndUpdate(req.user._id, { 'spotify.shareNowPlaying': !!share });
  res.json({ shareNowPlaying: !!share });
});

module.exports = router;
