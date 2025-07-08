import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURI = 'mongodb+srv://amrit0207232:RjoREvmmwwSaYZh2@gaalbaatha.v8vxvkw.mongodb.net/';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Define Mongoose schemas and models
const userSchema = new mongoose.Schema({
  socketId: String,
  displayName: String,
});

const roomSchema = new mongoose.Schema({
  roomId: String,
  users: [userSchema],
});

const Room = mongoose.model('Room', roomSchema);

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

  socket.on('join-room', async (data) => {
    console.log('join-room event data:', data);
    const { roomId, displayName } = data;
    console.log(`User ${socket.id} (${displayName}) joined room ${roomId}`);
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, displayName);

    // Save to MongoDB
    try {
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = new Room({ roomId, users: [] });
      }
      // Add or update user in room
      const existingUserIndex = room.users.findIndex(u => u.socketId === socket.id);
      if (existingUserIndex === -1) {
        room.users.push({ socketId: socket.id, displayName });
      } else {
        room.users[existingUserIndex].displayName = displayName;
      }
      await room.save();
    } catch (err) {
      console.error('Error saving join-room to MongoDB:', err);
    }

    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId: socket.id, displayName });

    // Send list of connected users to the new participant
    const users = Array.from(rooms.get(roomId))
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({ userId: id, displayName: name }));
    socket.emit('room-users', { users });
  });

  socket.on('leave-room', async (data) => {
    console.log('leave-room event data:', data);
    const { roomId } = data;
    handleUserLeaveRoom(socket, roomId);

    // Update MongoDB
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.users = room.users.filter(u => u.socketId !== socket.id);
        if (room.users.length === 0) {
          await Room.deleteOne({ roomId });
        } else {
          await room.save();
        }
      }
    } catch (err) {
      console.error('Error updating leave-room in MongoDB:', err);
    }
  });

  socket.on('disconnect', async () => {
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        handleUserLeaveRoom(socket, roomId);
      }
    });

    // Remove user from all rooms in MongoDB
    try {
      const roomDocs = await Room.find({ 'users.socketId': socket.id });
      for (const room of roomDocs) {
        room.users = room.users.filter(u => u.socketId !== socket.id);
        if (room.users.length === 0) {
          await Room.deleteOne({ roomId: room.roomId });
        } else {
          await room.save();
        }
      }
    } catch (err) {
      console.error('Error removing disconnected user from MongoDB:', err);
    }
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
    // console.log('answer event data:', data);
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

app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({});
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST API for user to join a meeting room
app.post('/api/rooms/:roomId/join', async (req, res) => {
  const { displayName, socketId } = req.body;
  const { roomId } = req.params;

  if (!displayName || !socketId) {
    return res.status(400).json({ message: 'displayName and socketId are required' });
  }

  try {
    let room = await Room.findOne({ roomId });
    if (!room) {
      room = new Room({ roomId, users: [] });
    }
    const existingUserIndex = room.users.findIndex(u => u.socketId === socketId);
    if (existingUserIndex === -1) {
      room.users.push({ socketId, displayName });
    } else {
      room.users[existingUserIndex].displayName = displayName;
    }
    await room.save();
    res.status(200).json({ message: 'User joined the room', room });
  } catch (err) {
    console.error('Error in join API:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET API to get users in a room (for video display)
app.get('/api/rooms/:roomId/users', async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(200).json({ users: room.users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
