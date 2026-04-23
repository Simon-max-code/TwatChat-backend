/* ============================================================
   TwatChat — services/spotify.js
   Spotify Client Credentials flow
   - Auto-refreshes token before expiry
   - Never exposes client secret to frontend
   ============================================================ */

'use strict';

let _accessToken  = null;
let _expiresAt    = 0;   // Unix ms timestamp

/**
 * Returns a valid Spotify access token.
 * Uses cached token if still valid; fetches a fresh one otherwise.
 */
const getSpotifyToken = async () => {
  const now = Date.now();

  // Return cached token if it has > 60s left
  if (_accessToken && now < _expiresAt - 60_000) {
    return _accessToken;
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured');
  }

  const credentials = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  // ADD temporarily inside getSpotifyToken(), after the fetch:

  console.log('Spotify token response status:', res.status);
if (!res.ok) {
  const errText = await res.text();
  console.error('Spotify token error:', errText);
  throw new Error(`Spotify token fetch failed: ${errText}`);
}


  const data = await res.json();
  _accessToken = data.access_token;
  _expiresAt   = now + data.expires_in * 1000; // expires_in is in seconds

  console.log('🎵 Spotify token refreshed');
  return _accessToken;
};


// ADD temporarily at the top of searchTracks(), remove after confirming:
const searchSpotify = async (query, limit = 10) => {
  console.log('Spotify search — query:', query, '| limit:', limit, '| type:', typeof limit);
}
/**
 * Search Spotify for tracks.
 * Returns an array of normalised track objects.
 */
const searchTracks = async (query, limit = 20) => {
  const token = await getSpotifyToken();

  const safeLimit = Math.min(Math.max(Math.floor(Number(limit)), 1), 50);

const url = new URL('https://api.spotify.com/v1/search');
url.searchParams.append('q',      query);
url.searchParams.append('type',   'track');
url.searchParams.append('limit',  safeLimit);
url.searchParams.append('market', 'US');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });


  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify search failed: ${err}`);
  }

  const data = await res.json();
  return normaliseTracks(data.tracks?.items || []);
};

/**
 * Get a single track by Spotify ID.
 */
const getTrack = async (trackId) => {
  const token = await getSpotifyToken();

  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify track fetch failed: ${err}`);
  }

  const data = await res.json();
  return normaliseTrack(data);
};

/**
 * Get recommendations based on seed tracks/artists/genres.
 */
const getRecommendations = async ({ seedTracks = [], seedGenres = [], limit = 20 } = {}) => {
  const token = await getSpotifyToken();

  const url = new URL('https://api.spotify.com/v1/recommendations');
const safeLimit = Math.min(Math.max(Math.floor(Number(limit)), 1), 100);
url.searchParams.append('limit',  safeLimit);
url.searchParams.append('market', 'US');

  if (seedTracks.length)  url.searchParams.set('seed_tracks',  seedTracks.slice(0, 5).join(','));
  if (seedGenres.length)  url.searchParams.set('seed_genres',  seedGenres.slice(0, 5).join(','));
  if (!seedTracks.length && !seedGenres.length) {
    // Default seeds when nothing is provided
    url.searchParams.set('seed_genres', 'pop,hip-hop,r-n-b');
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify recommendations failed: ${err}`);
  }

  const data = await res.json();
  return normaliseTracks(data.tracks || []);
};

/**
 * Get available genre seeds from Spotify.
 */
const getGenres = async () => {
  const token = await getSpotifyToken();

  const res = await fetch(
    'https://api.spotify.com/v1/recommendations/available-genre-seeds',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error('Failed to fetch genres');
  const data = await res.json();
  return data.genres || [];
};

// ── Normalisers ────────────────────────────────────────────

function normaliseTrack(t) {
  if (!t) return null;
  return {
    spotifyId:    t.id,
    title:        t.name,
    artist:       t.artists?.map(a => a.name).join(', ') || 'Unknown',
    artistId:     t.artists?.[0]?.id || null,
    album:        t.album?.name || '',
    albumArt:     t.album?.images?.[0]?.url || '',    // largest image
    albumArtSm:   t.album?.images?.[2]?.url || '',    // smallest (64px)
    duration:     formatDuration(t.duration_ms),
    durationMs:   t.duration_ms,
    previewUrl:   t.preview_url || null,              // 30s MP3 or null
    spotifyUrl:   t.external_urls?.spotify || null,
    explicit:     t.explicit || false,
    popularity:   t.popularity || 0,
    releaseDate:  t.album?.release_date || '',
  };
}

function normaliseTracks(items) {
  return items
    .filter(Boolean)
    .map(normaliseTrack)
    .filter(Boolean);
}

function formatDuration(ms) {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = {
  getSpotifyToken,
  searchTracks,
  getTrack,
  getRecommendations,
  getGenres,
};