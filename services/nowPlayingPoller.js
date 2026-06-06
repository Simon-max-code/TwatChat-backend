'use strict';

const User = require('../models/user');
const Chat = require('../models/chat');
const { getNowPlaying } = require('./spotifyAuth');

const _lastTrack = new Map();

const startNowPlayingPoller = (io) => {
  setInterval(async () => {
    try {
      const users = await User.find({
        'spotify.connected':      true,
        'spotify.shareNowPlaying': true,
      }).select('_id');

      await Promise.allSettled(users.map(async (u) => {
        const userId = String(u._id);
        try {
          const track = await getNowPlaying(userId);
          const key   = track?.spotifyId ?? null;

          if (_lastTrack.get(userId) === key) return;
          _lastTrack.set(userId, key);

          const chats = await Chat.find({
            isGroup: false,
            members: u._id,
          }).select('members');

          const friendIds = new Set();
          chats.forEach((c) => {
            c.members.forEach((m) => {
              if (String(m) !== userId) friendIds.add(String(m));
            });
          });

          friendIds.forEach((friendId) => {
            io.to(friendId).emit('spotify:nowPlaying', {
              userId,
              track,
            });
          });

          io.to(userId).emit('spotify:nowPlaying', { userId, track });
        } catch (err) {
          console.error('[NowPlayingPoller user]', err.message);
        }
      }));
    } catch (err) {
      console.error('[NowPlayingPoller]', err.message);
    }
  }, 10_000);

  console.log('🎵 Spotify now-playing poller started');
};

module.exports = { startNowPlayingPoller };
