import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (data) => {
    console.log('join-room event data:', data);
    const { roomId, displayName } = data;
    console.log(`User ${socket.id} (${displayName}) joined room ${roomId}`);
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, displayName);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId: socket.id, displayName });

    // Send list of connected users to the new participant
    const users = Array.from(rooms.get(roomId))
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({ userId: id, displayName: name }));
    socket.emit('room-users', { users });
  });

  socket.on('leave-room', (data) => {
    console.log('leave-room event data:', data);
    const { roomId } = data;
    handleUserLeaveRoom(socket, roomId);
  });

  socket.on('disconnect', () => {
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        handleUserLeaveRoom(socket, roomId);
      }
    });
  });

  socket.on('offer', (data) => {
    // console.log('offer event data:', data);
    const { userId, offer } = data;
    socket.to(userId).emit('offer', {
      userId: socket.id,
      offer
    });
  });

  socket.on('answer', (data) => {
    console.log('answer event data:', data);
    const { userId, answer } = data;
    socket.to(userId).emit('answer', {
      userId: socket.id,
      answer
    });
  });

  socket.on('ice-candidate', (data) => {
    // console.log('ice-candidate event data:', data);
    const { userId, candidate } = data;
    socket.to(userId).emit('ice-candidate', {
      userId: socket.id,
      candidate
    });
  });
});

function handleUserLeaveRoom(socket, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
    socket.to(roomId).emit('user-left', { userId: socket.id });
  }
  socket.leave(roomId);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});