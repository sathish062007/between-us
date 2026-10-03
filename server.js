/**
 * The Between Us - Pure Node.js & Socket.IO Server (ESM)
 * Hasatz Solutions Private Limited
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e7
});

// In-Memory Rooms State
const rooms = new Map();

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', roomsActive: rooms.size, timestamp: Date.now() });
});

// Room Status API
app.get('/api/rooms/:roomId/status', (req, res) => {
  const roomId = req.params.roomId.toUpperCase().trim();
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    roomId: room.roomId,
    participantCount: room.participants.size,
    isFull: room.participants.size >= 2
  });
});

// Socket.IO Real-Time Sync Engine
io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUserId = null;

  // 1. Join / Create 2P Room
  socket.on('room:join', (data, callback) => {
    try {
      let targetRoomId = (data.roomId || '').trim().toUpperCase();

      if (!targetRoomId) {
        do {
          targetRoomId = generateRoomCode();
        } while (rooms.has(targetRoomId));

        rooms.set(targetRoomId, {
          roomId: targetRoomId,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          participants: new Map(),
          currentMedia: {
            type: 'direct',
            title: 'Sintel - Open Cinema Trailer (Sample)',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
          },
          playback: {
            isPlaying: false,
            currentTime: 0,
            lastUpdated: Date.now()
          }
        });
      }

      const room = rooms.get(targetRoomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found or expired.' });
      }

      const existingUserSocket = Array.from(room.participants.entries()).find(([_, p]) => p.userId === data.userId)?.[0];
      if (room.participants.size >= 2 && !existingUserSocket) {
        return callback?.({ success: false, error: 'The Between Us room is full (Maximum 2 people allowed).' });
      }

      if (existingUserSocket && existingUserSocket !== socket.id) {
        room.participants.delete(existingUserSocket);
      }

      currentRoomId = targetRoomId;
      currentUserId = data.userId;
      socket.join(targetRoomId);

      const participant = {
        id: socket.id,
        userId: data.userId,
        name: data.userName || `Viewer_${Math.floor(100 + Math.random() * 900)}`,
        avatar: data.userAvatar || '🍿',
        avatarUrl: data.userAvatarUrl || '',
        email: data.email || '',
        authProvider: data.authProvider || 'guest',
        latency: 20
      };

      room.participants.set(socket.id, participant);
      room.lastActivity = Date.now();

      const participantsList = Array.from(room.participants.values());
      io.to(targetRoomId).emit('room:updated', {
        roomId: targetRoomId,
        participants: participantsList,
        currentMedia: room.currentMedia,
        playback: room.playback
      });

      socket.to(targetRoomId).emit('system:notification', {
        type: 'user_joined',
        message: `${participant.name} joined the room!`
      });

      callback?.({
        success: true,
        roomId: targetRoomId,
        participants: participantsList,
        currentMedia: room.currentMedia,
        playback: room.playback,
        self: participant
      });
    } catch (e) {
      console.error('Error joining room:', e);
      callback?.({ success: false, error: 'Server error joining room' });
    }
  });

  // 2. Playback Synchronization (Equal control for both members)
  socket.on('sync:play', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      room.playback.isPlaying = true;
      room.playback.currentTime = data.currentTime;
      room.lastActivity = Date.now();
      const sender = room.participants.get(socket.id);
      socket.to(currentRoomId).emit('sync:play', {
        currentTime: data.currentTime,
        senderId: socket.id,
        senderName: sender?.name || 'Partner',
        timestamp: Date.now()
      });
    }
  });

  socket.on('sync:pause', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      room.playback.isPlaying = false;
      room.playback.currentTime = data.currentTime;
      room.lastActivity = Date.now();
      const sender = room.participants.get(socket.id);
      socket.to(currentRoomId).emit('sync:pause', {
        currentTime: data.currentTime,
        senderId: socket.id,
        senderName: sender?.name || 'Partner',
        timestamp: Date.now()
      });
    }
  });

  socket.on('sync:seek', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      room.playback.currentTime = data.targetTime;
      if (typeof data.isPlaying === 'boolean') room.playback.isPlaying = data.isPlaying;
      room.lastActivity = Date.now();
      const sender = room.participants.get(socket.id);
      socket.to(currentRoomId).emit('sync:seek', {
        targetTime: data.targetTime,
        isPlaying: data.isPlaying,
        senderId: socket.id,
        senderName: sender?.name || 'Partner',
        timestamp: Date.now()
      });
    }
  });

  // 3. Media Switch
  socket.on('sync:media_change', (mediaData, callback) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      room.currentMedia = mediaData;
      room.playback = { isPlaying: false, currentTime: 0, lastUpdated: Date.now() };
      const sender = room.participants.get(socket.id);
      io.to(currentRoomId).emit('sync:media_changed', {
        media: mediaData,
        senderId: socket.id,
        senderName: sender?.name || 'Partner'
      });
      callback?.({ success: true });
    }
  });

  // 4. Live Chat
  socket.on('chat:send', (data) => {
    if (!currentRoomId || !data.text?.trim()) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      const sender = room.participants.get(socket.id);
      io.to(currentRoomId).emit('chat:received', {
        id: data.id || 'msg_' + Date.now(),
        senderId: socket.id,
        userId: sender?.userId || '',
        senderName: sender?.name || 'Partner',
        avatar: sender?.avatar || '🍿',
        avatarUrl: sender?.avatarUrl,
        text: data.text.slice(0, 500),
        videoTime: data.videoTime || 0,
        timestamp: Date.now()
      });
    }
  });

  // 5. Floating Reaction Bursts
  socket.on('sync:reaction', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      const sender = room.participants.get(socket.id);
      io.to(currentRoomId).emit('sync:reaction_burst', {
        emoji: data.emoji,
        senderName: sender?.name || 'Partner',
        timestamp: Date.now()
      });
    }
  });

  // 6. Latency Ping
  socket.on('ping:client', (timestamp, callback) => callback?.(timestamp));

  // 7. Leave / Disconnect
  const handleLeave = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      const participant = room.participants.get(socket.id);
      room.participants.delete(socket.id);
      socket.leave(currentRoomId);

      if (participant) {
        socket.to(currentRoomId).emit('system:notification', {
          type: 'user_left',
          message: `${participant.name} left the room`
        });
      }

      io.to(currentRoomId).emit('room:updated', {
        roomId: currentRoomId,
        participants: Array.from(room.participants.values()),
        currentMedia: room.currentMedia,
        playback: room.playback
      });

      if (room.participants.size === 0) {
        rooms.delete(currentRoomId);
      }
    }
    currentRoomId = null;
  };

  socket.on('room:leave', handleLeave);
  socket.on('disconnect', handleLeave);
});

// Serve Static Files (HTML, CSS, JS, Images, Icons)
const staticDir = path.join(__dirname);
app.use(express.static(staticDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎬 The Between Us - Cinema Server running on http://localhost:${PORT}`);
  console.log(`🚀 Powered by Hasatz Solutions Private Limited`);
});
