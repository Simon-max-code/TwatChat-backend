/* ============================================================
   TwatChat — services/spotify.js
   Spotify Client Credentials flow
   - Uses axios (reliable header handling on all Node versions)
   - Auto-refreshes token 60s before expiry
   - Retries once on 401 (token race condition guard)
   ============================================================ */

'use strict';

const axios = require('axios');

let _accessToken = null;
let _expiresAt   = 0;        // Unix ms

// ── Fetch (or return cached) Spotify access token ─────────
const getSpotifyToken = async (forceRefresh = false) => {
  const now = Date.now();

  if (!forceRefresh && _accessToken && now < _expiresAt - 60_000) {
    return _accessToken;
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured in environment variables');
  }

  const credentials = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',   // x-www-form-urlencoded body as string
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
      }
    );

    _accessToken = data.access_token.trim();   // trim any stray whitespace
    _expiresAt   = now + data.expires_in * 1000;

    console.log(`[Spotify] Token refreshed. Expires in ${data.expires_in}s`);
    return _accessToken;

  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    throw new Error(`Spotify token fetch failed: ${msg}`);
  }
};

// ── Shared axios instance for Spotify API calls ───────────
// ── Shared request helper — URL built manually to avoid param serialization issues ──
const spotifyGet = async (url, params = {}, retried = false) => {
  const token = await getSpotifyToken();

  // Build query string manually — no axios params serialization
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const fullUrl = queryString ? `${url}?${queryString}` : url;

  try {
    const { data } = await axios.get(fullUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
      },
      // NO params key here — already in URL
    });
    return data;

  } catch (err) {
    const status = err.response?.status;

    if (status === 401 && !retried) {
      console.warn('[Spotify] Got 401 — refreshing token and retrying…');
      _accessToken = null;
      return spotifyGet(url, params, true);
    }

    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Spotify API error (${status}): ${msg}`);
  }
};

const searchTracks = async (query, limit = 20) => {
  if (!query || !query.trim()) throw new Error('Search query cannot be empty');

  const token = await getSpotifyToken();

  // Build URL manually — axios params serialization was causing Spotify to reject limit
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query.trim())}&type=track&limit=${safeLimit}&market=US`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    return normaliseTracks(data.tracks?.items || []);

  } catch (err) {
    const status = err.response?.status;

    // 401 = token expired mid-flight — refresh once and retry
    if (status === 401) {
      _accessToken = null;
      return searchTracks(query, limit); // retry once with fresh token
    }

    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Spotify search failed: ${msg}`);
  }
};

// ── Get single track ───────────────────────────────────────
const getTrack = async (trackId) => {
  if (!trackId) throw new Error('Track ID required');

  const data = await spotifyGet(`https://api.spotify.com/v1/tracks/${trackId}`, {
    market: 'US',
  });

  return normaliseTrack(data);
};

// ── Get recommendations ────────────────────────────────────
const getRecommendations = async ({ seedTracks = [], seedGenres = [], limit = 20 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

 // REPLACE WITH
const params = {
  limit:  String(safeLimit),
  market: 'US',
};

  if (seedTracks.length) params.seed_tracks  = seedTracks.slice(0, 5).join(',');
  if (seedGenres.length) params.seed_genres  = seedGenres.slice(0, 5).join(',');

  // Fallback seeds when none provided
  if (!seedTracks.length && !seedGenres.length) {
    params.seed_genres = 'pop,hip-hop,r-n-b';
  }

  const data = await spotifyGet(
    'https://api.spotify.com/v1/recommendations',
    params
  );

  return normaliseTracks(data.tracks || []);
};

// ── Get available genre seeds ──────────────────────────────
const getGenres = async () => {
  const data = await spotifyGet(
    'https://api.spotify.com/v1/recommendations/available-genre-seeds'
  );
  return data.genres || [];
};

// ── Normalisers ────────────────────────────────────────────
function normaliseTrack(t) {
  if (!t) return null;
  return {
    spotifyId:   t.id,
    title:       t.name,
    artist:      t.artists?.map(a => a.name).join(', ') || 'Unknown',
    artistId:    t.artists?.[0]?.id || null,
    album:       t.album?.name || '',
    albumArt:    t.album?.images?.[0]?.url || '',
    albumArtSm:  t.album?.images?.[2]?.url || '',
    duration:    formatDuration(t.duration_ms),
    durationMs:  t.duration_ms,
    previewUrl:  t.preview_url || null,
    spotifyUrl:  t.external_urls?.spotify || null,
    explicit:    t.explicit || false,
    popularity:  t.popularity || 0,
    releaseDate: t.album?.release_date || '',
  };
}

function normaliseTracks(items) {
  return items.filter(Boolean).map(normaliseTrack).filter(Boolean);
}

function formatDuration(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

module.exports = {
  getSpotifyToken,
  searchTracks,
  getTrack,
  getRecommendations,
  getGenres,
};