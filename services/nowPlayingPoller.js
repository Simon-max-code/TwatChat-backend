'use strict';

const User = require('../models/user');
const Chat = require('../models/chat');
const { getNowPlaying } = require('./spotifyAuth');

const _lastTrack = new Map(); // userId → spotifyId|null|'paused'

// Call this from presence socket when user comes back online
const clearUserCache = (userId) => {
  _lastTrack.delete(String(userId));
};

const startNowPlayingPoller = (io) => {
  const poll = async () => {
    try {
      const users = await User.find({
        'spotify.connected':       true,
        'spotify.shareNowPlaying': true,
      }).select('_id');

      await Promise.allSettled(users.map(async (u) => {
        const userId = String(u._id);
        try {
          const track = await getNowPlaying(userId);
          const key = track ? `${track.spotifyId}:${track.isPlaying}` : null;

          if (_lastTrack.get(userId) === key) return;
          _lastTrack.set(userId, key);

          const chats = await Chat.find({ isGroup: false, members: u._id }).select('members');
          const friendIds = new Set();
          chats.forEach((c) => c.members.forEach((m) => {
            if (String(m) !== userId) friendIds.add(String(m));
          }));

          const payload = { userId, track };
          io.to(userId).emit('spotify:nowPlaying', payload);
          friendIds.forEach((fid) => io.to(fid).emit('spotify:nowPlaying', payload));

        } catch (_) {}
      }));
    } catch (err) {
      console.error('[NowPlayingPoller]', err.message);
    } finally {
      setTimeout(poll, 3000);
    }
  };

  poll();
  console.log('🎵 Spotify now-playing poller started (3s)');
};

module.exports = { startNowPlayingPoller, clearUserCache };
