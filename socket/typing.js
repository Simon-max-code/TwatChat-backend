/* ============================================================
   TwatChat — socket/typing.js
   Typing indicators — broadcast to chat room members
   ============================================================ */

'use strict';

module.exports = (io, socket) => {

  // ── User started typing ───────────────────────────────────
  socket.on('typing:start', ({ chatId, userId, userName }) => {
    if (!chatId || !userId) return;

    // Broadcast to everyone in the room EXCEPT the typer
    socket.to(chatId).emit('typing:update', {
      chatId,
      userId,
      userName,
      isTyping: true,
    });
  });

  // ── User stopped typing ───────────────────────────────────
  socket.on('typing:stop', ({ chatId, userId }) => {
    if (!chatId || !userId) return;

    socket.to(chatId).emit('typing:update', {
      chatId,
      userId,
      isTyping: false,
    });
  });

};