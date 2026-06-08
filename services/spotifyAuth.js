 'use strict';

const axios = require('axios');
const User  = require('../models/user');

const CLIENT_ID     = () => process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = () => process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI  = () => process.env.SPOTIFY_REDIRECT_URI;

const _tokenCache = new Map(); // userId -> { token, expiresAt }

// ── Exchange code for tokens ─────────────────────────────
const exchangeCode = async (code) => {
  const creds = Buffer.from(`${CLIENT_ID()}:${CLIENT_SECRET()}`).toString('base64');
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI(),
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return data;
};

// ── Refresh a user's access token ─────────────────────────
const refreshUserToken = async (userId) => {
  const user = await User.findById(userId).select('spotify');
  if (!user?.spotify?.refreshToken) throw new Error('No refresh token');

  const creds = Buffer.from(`${CLIENT_ID()}:${CLIENT_SECRET()}`).toString('base64');
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: user.spotify.refreshToken,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const accessToken = data.access_token;
  const expiresAt = Date.now() + data.expires_in * 1000;

  user.spotify.accessToken = accessToken;
  user.spotify.expiresAt   = expiresAt;
  if (data.refresh_token) user.spotify.refreshToken = data.refresh_token;
  await user.save();

  _tokenCache.set(userId, { token: accessToken, expiresAt });

  return accessToken;
};

// ── Get a valid access token (auto-refresh if needed) ─────
const getValidToken = async (userId) => {
  const cached = _tokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const user = await User.findById(userId).select('spotify');
  if (!user?.spotify?.connected) return null;

  let token = user.spotify.accessToken;
  let expiresAt = user.spotify.expiresAt;

  if (!token) return null;

  if (!expiresAt || Date.now() >= expiresAt - 60_000) {
    token = await refreshUserToken(userId);
    const updated = await User.findById(userId).select('spotify');
    expiresAt = updated.spotify.expiresAt;
  }

  _tokenCache.set(userId, { token, expiresAt });
  return token;
};

// ── Get now playing track for a connected user ────────────
const getNowPlaying = async (userId) => {
  const token = await getValidToken(userId);
  if (!token) return null;

  try {
    const { data, status } = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (status === 204 || !data?.item) return null;

    const t = data.item;
    return {
      isPlaying:   data.is_playing,
      title:       t.name,
      artist:      t.artists.map((a) => a.name).join(', '),
      album:       t.album.name,
      albumArt:    t.album.images?.[0]?.url || '',
      spotifyUrl:  t.external_urls?.spotify || '',
      durationMs:  t.duration_ms,
      progressMs:  data.progress_ms,
      spotifyId:   t.id,
    };
  } catch (err) {
    if (err.response?.status === 401) {
      try {
        const newToken = await refreshUserToken(userId);
        const { data, status } = await axios.get(
          'https://api.spotify.com/v1/me/player/currently-playing',
          { headers: { Authorization: `Bearer ${newToken}` } }
        );

        if (status === 204 || !data?.item) return null;

        const t = data.item;
        return {
          isPlaying:   data.is_playing,
          title:       t.name,
          artist:      t.artists.map((a) => a.name).join(', '),
          album:       t.album.name,
          albumArt:    t.album.images?.[0]?.url || '',
          spotifyUrl:  t.external_urls?.spotify || '',
          durationMs:  t.duration_ms,
          progressMs:  data.progress_ms,
          spotifyId:   t.id,
        };
      } catch (_) {
        return null;
      }
    }

    return null;
  }
};

module.exports = {
  exchangeCode,
  refreshUserToken,
  getValidToken,
  getNowPlaying,
};
