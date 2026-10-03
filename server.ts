import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e7
});

// Interfaces
export interface Participant {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  email?: string;
  authProvider?: 'google' | 'guest';
  joinedAt: number;
  isReady: boolean;
  isBuffering: boolean;
  playbackTime: number;
  isPlaying: boolean;
  networkQuality: 'excellent' | 'good' | 'weak';
  latency: number;
}

export interface MediaSourceState {
  type: 'local' | 'youtube' | 'direct' | 'stream_companion';
  title: string;
  url?: string;
  youtubeId?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  poster?: string;
  companionService?: string;
}

export interface RoomState {
  roomId: string;
  createdAt: number;
  lastActivity: number;
  participants: Map<string, Participant>;
  currentMedia: MediaSourceState;
  playback: {
    isPlaying: boolean;
    currentTime: number;
    lastUpdated: number;
    playbackRate: number;
  };
}

const rooms = new Map<string, RoomState>();

// Helper to generate clean readable 5-character alphanumeric room codes
function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Room auto-cleanup cron
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && now - room.lastActivity > 1000 * 60 * 30) {
      rooms.delete(roomId);
      console.log(`[WatchRoom] Auto-cleaned inactive empty room: ${roomId}`);
    }
  }
}, 1000 * 60 * 10);

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    roomsActive: rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/rooms/:roomId/status', (req, res) => {
  const roomId = req.params.roomId.toUpperCase().trim();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json({
    roomId: room.roomId,
    participantCount: room.participants.size,
    isFull: room.participants.size >= 2,
    hasMedia: !!room.currentMedia.title
  });
});

// Socket.IO Events
io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  // 1. Join or Create Room
  socket.on('room:join', ({
    roomId,
    userId,
    userName,
    userAvatar,
    userAvatarUrl,
    email,
    authProvider
  }: {
    roomId?: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    userAvatarUrl?: string;
    email?: string;
    authProvider?: 'google' | 'guest';
  }, callback) => {
    try {
      let targetRoomId = (roomId || '').trim().toUpperCase();

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
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            duration: 52,
            poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'
          },
          playback: {
            isPlaying: false,
            currentTime: 0,
            lastUpdated: Date.now(),
            playbackRate: 1.0,
          }
        });
        console.log(`[WatchRoom] Created room: ${targetRoomId}`);
      }

      const room = rooms.get(targetRoomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room does not exist or has expired.' });
      }

      const existingUserSocketId = Array.from(room.participants.entries()).find(([_, p]) => p.userId === userId)?.[0];

      if (room.participants.size >= 2 && !existingUserSocketId) {
        return callback?.({
          success: false,
          error: 'This private WatchRoom is full (Maximum 2 participants allowed).'
        });
      }

      if (existingUserSocketId && existingUserSocketId !== socket.id) {
        room.participants.delete(existingUserSocketId);
      }

      currentRoomId = targetRoomId;
      currentUserId = userId;
      socket.join(targetRoomId);

      const participant: Participant = {
        id: socket.id,
        userId: userId,
        name: userName || `Viewer_${Math.floor(100 + Math.random() * 900)}`,
        avatar: userAvatar || '🍿',
        avatarUrl: userAvatarUrl,
        email: email,
        authProvider: authProvider || 'guest',
        joinedAt: Date.now(),
        isReady: true,
        isBuffering: false,
        playbackTime: room.playback.currentTime,
        isPlaying: room.playback.isPlaying,
        networkQuality: 'good',
        latency: 20
      };

      room.participants.set(socket.id, participant);
      room.lastActivity = Date.now();

      const participantsList = Array.from(room.participants.values());
      io.to(targetRoomId).emit('room:updated', {
        roomId: targetRoomId,
        participants: participantsList,
        currentMedia: room.currentMedia,
        playback: room.playback,
      });

      socket.to(targetRoomId).emit('system:notification', {
        type: 'user_joined',
        message: `${participant.name} joined the room!`,
        timestamp: Date.now()
      });

      callback?.({
        success: true,
        roomId: targetRoomId,
        participants: participantsList,
        currentMedia: room.currentMedia,
        playback: room.playback,
        self: participant
      });

      console.log(`[WatchRoom] User ${participant.name} (${participant.authProvider || 'guest'}) joined ${targetRoomId}. (${room.participants.size}/2)`);
    } catch (err: any) {
      console.error('[WatchRoom] Error in room:join', err);
      callback?.({ success: false, error: 'Failed to join room' });
    }
  });

  // 2. Playback Synchronization
  socket.on('sync:play', (data: { currentTime: number; actionId: string }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.playback.isPlaying = true;
    room.playback.currentTime = data.currentTime;
    room.playback.lastUpdated = Date.now();
    room.lastActivity = Date.now();

    const sender = room.participants.get(socket.id);

    socket.to(currentRoomId).emit('sync:play', {
      currentTime: data.currentTime,
      actionId: data.actionId,
      senderId: socket.id,
      senderName: sender?.name || 'Friend',
      timestamp: Date.now()
    });
  });

  socket.on('sync:pause', (data: { currentTime: number; actionId: string }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.playback.isPlaying = false;
    room.playback.currentTime = data.currentTime;
    room.playback.lastUpdated = Date.now();
    room.lastActivity = Date.now();

    const sender = room.participants.get(socket.id);

    socket.to(currentRoomId).emit('sync:pause', {
      currentTime: data.currentTime,
      actionId: data.actionId,
      senderId: socket.id,
      senderName: sender?.name || 'Friend',
      timestamp: Date.now()
    });
  });

  socket.on('sync:seek', (data: { targetTime: number; isPlaying?: boolean; actionId: string }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.playback.currentTime = data.targetTime;
    if (typeof data.isPlaying === 'boolean') {
      room.playback.isPlaying = data.isPlaying;
    }
    room.playback.lastUpdated = Date.now();
    room.lastActivity = Date.now();

    const sender = room.participants.get(socket.id);

    socket.to(currentRoomId).emit('sync:seek', {
      targetTime: data.targetTime,
      isPlaying: room.playback.isPlaying,
      actionId: data.actionId,
      senderId: socket.id,
      senderName: sender?.name || 'Friend',
      timestamp: Date.now()
    });
  });

  // 3. Heartbeat
  socket.on('sync:heartbeat', (data: { currentTime: number; isPlaying: boolean; latency?: number }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.playbackTime = data.currentTime;
      participant.isPlaying = data.isPlaying;
      if (data.latency) participant.latency = data.latency;
    }

    socket.to(currentRoomId).emit('sync:peer_status', {
      peerId: socket.id,
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      latency: participant?.latency || 20
    });
  });

  // 4. Media Change
  socket.on('sync:media_change', (mediaData: MediaSourceState, callback) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.currentMedia = mediaData;
    room.playback = {
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      playbackRate: 1.0,
    };
    room.lastActivity = Date.now();

    const sender = room.participants.get(socket.id);

    io.to(currentRoomId).emit('sync:media_changed', {
      media: mediaData,
      senderId: socket.id,
      senderName: sender?.name || 'Friend',
      playback: room.playback
    });

    callback?.({ success: true });
  });

  // 5. Buffering State
  socket.on('sync:buffering', (data: { isBuffering: boolean }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.isBuffering = data.isBuffering;
    }

    socket.to(currentRoomId).emit('sync:peer_buffering', {
      peerId: socket.id,
      senderName: participant?.name || 'Friend',
      isBuffering: data.isBuffering
    });
  });

  // 6. Live Chat Messages
  socket.on('chat:send', (data: { text: string; id: string }) => {
    if (!currentRoomId || !data.text?.trim()) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const sender = room.participants.get(socket.id);
    const message = {
      id: data.id || `msg_${Date.now()}_${Math.random()}`,
      senderId: socket.id,
      userId: sender?.userId || '',
      senderName: sender?.name || 'Friend',
      avatar: sender?.avatar || '🍿',
      avatarUrl: sender?.avatarUrl,
      text: data.text.slice(0, 500),
      timestamp: Date.now()
    };

    io.to(currentRoomId).emit('chat:received', message);
  });

  // 7. Synchronized Screen Reaction Bursts
  socket.on('sync:reaction', (data: { emoji: string; x?: number; y?: number }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const sender = room.participants.get(socket.id);

    io.to(currentRoomId).emit('sync:reaction_burst', {
      emoji: data.emoji,
      senderName: sender?.name || 'Friend',
      x: data.x,
      y: data.y,
      timestamp: Date.now()
    });
  });

  // 8. WebRTC Signaling
  socket.on('webrtc:signal', (data: { targetPeerId?: string; signal: any; meta?: any }) => {
    if (!currentRoomId) return;
    if (data.targetPeerId) {
      io.to(data.targetPeerId).emit('webrtc:signal', {
        senderPeerId: socket.id,
        signal: data.signal,
        meta: data.meta
      });
    } else {
      socket.to(currentRoomId).emit('webrtc:signal', {
        senderPeerId: socket.id,
        signal: data.signal,
        meta: data.meta
      });
    }
  });

  // 9. Low-Speed / Network Quality update
  socket.on('network:quality', (data: { quality: 'excellent' | 'good' | 'weak'; latency: number }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.networkQuality = data.quality;
      participant.latency = data.latency;

      socket.to(currentRoomId).emit('network:peer_quality', {
        peerId: socket.id,
        quality: data.quality,
        latency: data.latency
      });
    }
  });

  // 10. Ping
  socket.on('ping:client', (timestamp: number, callback) => {
    callback?.(timestamp);
  });

  // 11. Leave Room / Disconnect
  const handleLeave = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    room.participants.delete(socket.id);
    room.lastActivity = Date.now();

    socket.leave(currentRoomId);

    if (participant) {
      socket.to(currentRoomId).emit('system:notification', {
        type: 'user_left',
        message: `${participant.name} left the room`,
        timestamp: Date.now()
      });
    }

    const participantsList = Array.from(room.participants.values());
    io.to(currentRoomId).emit('room:updated', {
      roomId: currentRoomId,
      participants: participantsList,
      currentMedia: room.currentMedia,
      playback: room.playback
    });

    console.log(`[WatchRoom] Participant left ${currentRoomId}. Remaining: ${room.participants.size}`);

    if (room.participants.size === 0) {
      setTimeout(() => {
        const fresh = rooms.get(currentRoomId!);
        if (fresh && fresh.participants.size === 0) {
          rooms.delete(currentRoomId!);
          console.log(`[WatchRoom] Destroyed empty room ${currentRoomId}`);
        }
      }, 1000 * 60 * 5);
    }

    currentRoomId = null;
  };

  socket.on('room:leave', handleLeave);
  socket.on('disconnect', handleLeave);
});

const rootPath = path.join(__dirname, '..');
const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(rootPath));
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const rootIndex = path.join(rootPath, 'index.html');
  res.sendFile(rootIndex, (err) => {
    if (err) {
      res.sendFile(path.join(distPath, 'index.html'), (err2) => {
        if (err2) res.send(`WatchRoom Backend running on port 3001.`);
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎬 WatchRoom Server running on http://localhost:${PORT}`);
});
