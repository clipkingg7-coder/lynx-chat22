// StrangerChat — real random-stranger text chat
// Node.js + Express + Socket.IO. One deploy serves both the site and the backend.
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 3000;

// Serve the frontend (put index.html in /public)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- state ----------
// waiting queue: [{ socketId, interests: [..], since: ms }]
let waiting = [];
// pairs: socketId -> { partner: socketId, room: roomId }
const pairs = new Map();

const MAX_MSG_LEN = 2000;
const MAX_INTERESTS = 10;

// ---------- helpers ----------
function broadcastOnline() {
  io.emit('online', io.engine.clientsCount);
}

function leaveCurrent(socket, notifyPartner) {
  const p = pairs.get(socket.id);
  if (!p) return;
  if (notifyPartner) {
    io.to(p.partner).emit('partner:left');
    pairs.delete(p.partner);
  }
  try { socket.leave(p.room); } catch (e) {}
  pairs.delete(socket.id);
}

function removeFromWaiting(socketId) {
  waiting = waiting.filter(w => w.socketId !== socketId);
}

// Try to match a joining socket with someone in the waiting queue.
// Prefers a partner with at least one shared interest; falls back to longest-waiting.
function tryMatch(socket) {
  const myInterests = new Set((socket.data.interests || []).map(s => String(s).toLowerCase().trim()).filter(Boolean));

  let partner = null;
  // pass 1: shared interest
  for (const w of waiting) {
    if (w.interests.some(i => myInterests.has(i))) { partner = w; break; }
  }
  // pass 2: oldest waiting
  if (!partner && waiting.length > 0) partner = waiting[0];

  if (!partner) {
    waiting.push({ socketId: socket.id, interests: [...myInterests], since: Date.now() });
    io.to(socket.id).emit('searching');
    return false;
  }

  removeFromWaiting(partner.socketId);
  const partnerSocket = io.sockets.sockets.get(partner.socketId);
  if (!partnerSocket || !partnerSocket.connected) {
    // stale entry, retry match for this socket
    return tryMatch(socket);
  }

  const room = 'room-' + socket.id + '-' + partner.socketId;
  try { socket.join(room); partnerSocket.join(room); } catch (e) {}

  pairs.set(socket.id, { partner: partner.socketId, room });
  pairs.set(partner.socketId, { partner: socket.id, room });
  socket.data.room = room;
  partnerSocket.data.room = room;

  io.to(socket.id).emit('matched');
  io.to(partner.socketId).emit('matched');
  return true;
}

// ---------- socket events ----------
io.on('connection', (socket) => {
  broadcastOnline();

  socket.on('join', (payload) => {
    const interests = Array.isArray(payload && payload.interests)
      ? payload.interests.slice(0, MAX_INTERESTS)
      : [];
    socket.data.interests = interests;

    leaveCurrent(socket, true);   // leave any existing chat, notify partner
    removeFromWaiting(socket.id);
    tryMatch(socket);
  });

  socket.on('chat:message', (text) => {
    const p = pairs.get(socket.id);
    if (!p) return;
    const clean = String(text == null ? '' : text).slice(0, MAX_MSG_LEN);
    if (!clean.trim()) return;
    io.to(p.partner).emit('chat:message', clean);
  });

  socket.on('typing', () => {
    const p = pairs.get(socket.id);
    if (p) io.to(p.partner).emit('typing');
  });

  socket.on('stop:typing', () => {
    const p = pairs.get(socket.id);
    if (p) io.to(p.partner).emit('stop:typing');
  });

  socket.on('leave', () => {
    leaveCurrent(socket, true);
    removeFromWaiting(socket.id);
  });

  socket.on('disconnect', () => {
    leaveCurrent(socket, true);
    removeFromWaiting(socket.id);
    broadcastOnline();
  });
});

// safety: drop waiting entries older than 5 minutes every 30s
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  const before = waiting.length;
  waiting = waiting.filter(w => {
    if (w.since < cutoff) { io.to(w.socketId).emit('search:timeout'); return false; }
    return true;
  });
  if (waiting.length !== before) broadcastOnline();
}, 30000);

server.listen(PORT, () => {
  console.log('StrangerChat live on http://localhost:' + PORT);
});
