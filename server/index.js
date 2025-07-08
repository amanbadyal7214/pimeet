import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// roomId => Map<socketId, displayName>
const rooms = new Map();
// socketId => roomId
const userRoomMap = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // 🟢 Join room
  socket.on('join-room', ({ roomId, displayName }) => {
    console.log(`➡️ ${socket.id} (${displayName}) joined room ${roomId}`);
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    rooms.get(roomId).set(socket.id, displayName);
    userRoomMap.set(socket.id, roomId);

    // Notify others
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      displayName,
    });

    // Send current users to the new joiner
    const users = Array.from(rooms.get(roomId))
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({ userId: id, displayName: name }));

    socket.emit('room-users', { users });
  });

  // 🔁 Media status updates
  socket.on('user-status-update', ({ audioEnabled, videoEnabled }) => {
    const roomId = userRoomMap.get(socket.id);
    if (!roomId) return;

    socket.to(roomId).emit('user-status-update', {
      userId: socket.id,
      audioEnabled,
      videoEnabled,
    });
  });

  // 🔄 Manual leave
  socket.on('leave-room', ({ roomId }) => {
    handleUserLeaveRoom(socket, roomId);
  });

  // ❌ Disconnect
  socket.on('disconnect', () => {
    const roomId = userRoomMap.get(socket.id);
    if (roomId) {
      handleUserLeaveRoom(socket, roomId);
      userRoomMap.delete(socket.id);
    }
  });

  // 📡 WebRTC signaling
  socket.on('offer', ({ userId, offer }) => {
    socket.to(userId).emit('offer', {
      userId: socket.id,
      offer,
    });
  });

  socket.on('answer', ({ userId, answer }) => {
    socket.to(userId).emit('answer', {
      userId: socket.id,
      answer,
    });
  });

  socket.on('ice-candidate', ({ userId, candidate }) => {
    socket.to(userId).emit('ice-candidate', {
      userId: socket.id,
      candidate,
    });
  });
});

// 🧼 Leave helper
function handleUserLeaveRoom(socket, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(socket.id);
    socket.to(roomId).emit('user-left', { userId: socket.id });

    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
  socket.leave(roomId);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
