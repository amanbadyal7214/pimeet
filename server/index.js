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
// roomId => Set<displayName> (kicked users for today)
const kickedUsers = new Map();
// roomId => Array<pendingUser> (users waiting for entry approval)
const pendingEntries = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // 🟢 Join room with trainer approval
  socket.on('join-room', ({ roomId, displayName }) => {
    console.log(`➡️ ${socket.id} (${displayName}) wants to join room ${roomId}`);
    
    // Check if this is a trainer (more robust check)
    const isTrainer = displayName.includes('(trainer)') || 
                     displayName.toLowerCase().includes('trainer') ||
                     displayName.match(/\(trainer\)/i);
    
    console.log(`🔍 User ${displayName} - isTrainer: ${isTrainer}`);
    
    // Check if user was kicked in the last 2 hours
    if (!kickedUsers.has(roomId)) {
      kickedUsers.set(roomId, new Map());
    }
    
    const roomKickedUsers = kickedUsers.get(roomId);
    const kickedEntry = roomKickedUsers.get(displayName);
    
    if (kickedEntry) {
      const kickTime = new Date(kickedEntry.kickTime);
      const currentTime = new Date();
      const timeDifference = (currentTime.getTime() - kickTime.getTime()) / (1000 * 60 * 60); // Hours
      
      if (timeDifference < 2 && !kickedEntry.approved) {
        // User was kicked less than 2 hours ago and doesn't have permission
        const remainingTime = Math.ceil((2 - timeDifference) * 60); // Convert to minutes
        
        socket.emit('kick-permission-required', {
          message: `You were removed from this meeting. You cannot rejoin for ${remainingTime} minutes. Please wait for trainer approval.`,
          remainingTime: remainingTime
        });
        
        // Notify trainer about rejoin request
        const room = rooms.get(roomId);
        if (room) {
          Array.from(room.entries()).forEach(([socketId, userName]) => {
            if (userName.includes('(trainer)') || userName.toLowerCase().includes('trainer')) {
              socket.to(socketId).emit('rejoin-request', {
                userId: socket.id,
                displayName: displayName,
                roomId: roomId,
                kickTime: kickedEntry.kickTime,
                remainingTime: remainingTime
              });
            }
          });
        }
        
        console.log(`🚫 ${displayName} needs to wait ${remainingTime} minutes or get trainer approval to rejoin room ${roomId}`);
        return;
      } else if (timeDifference >= 2) {
        // 2 hours have passed, remove the restriction
        roomKickedUsers.delete(displayName);
        console.log(`⏰ 2 hours restriction expired for ${displayName} in room ${roomId}`);
      }
    }

    // If trainer, allow direct entry
    if (isTrainer) {
      console.log(`👨‍🏫 Trainer ${displayName} joining directly`);
      joinUserToRoom(socket, roomId, displayName);
      return;
    }

    // For non-trainers, check if there's a trainer in the room
    const room = rooms.get(roomId);
    const hasTrainer = room && Array.from(room.values()).some(name => 
      name.includes('(trainer)') || name.toLowerCase().includes('trainer') || name.match(/\(trainer\)/i)
    );

    console.log(`🏫 Room ${roomId} has trainer: ${hasTrainer}`);

    if (!hasTrainer) {
      // No trainer present, allow direct entry
      console.log(`📝 No trainer in room, allowing direct entry for ${displayName}`);
      joinUserToRoom(socket, roomId, displayName);
      return;
    }

    // Trainer is present, require approval
    console.log(`⏳ Trainer present, requiring approval for ${displayName}`);
    if (!pendingEntries.has(roomId)) {
      pendingEntries.set(roomId, []);
    }

    const pendingList = pendingEntries.get(roomId);
    const existingRequest = pendingList.find(req => req.socketId === socket.id);
    
    if (!existingRequest) {
      pendingList.push({
        socketId: socket.id,
        displayName: displayName,
        timestamp: new Date().toISOString()
      });

      // Notify user they need approval
      socket.emit('entry-permission-required', {
        message: 'Waiting for trainer approval to join the meeting...'
      });

      // Notify trainer about entry request
      Array.from(room.entries()).forEach(([socketId, userName]) => {
        if (userName.includes('(trainer)') || userName.toLowerCase().includes('trainer')) {
          socket.to(socketId).emit('entry-request', {
            userId: socket.id,
            displayName: displayName,
            roomId: roomId
          });
        }
      });

      console.log(`⏳ ${displayName} waiting for trainer approval to join room ${roomId}`);
    }
  });

  // Helper function to join user to room
  function joinUserToRoom(socket, roomId, displayName) {
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
    
    console.log(`✅ ${displayName} successfully joined room ${roomId}`);
  }

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

  // 📺 Screen sharing events
  socket.on('screen-share-started', () => {
    const roomId = userRoomMap.get(socket.id);
    if (!roomId) return;

    socket.to(roomId).emit('screen-share-started', {
      userId: socket.id,
    });
  });

  socket.on('screen-share-stopped', () => {
    const roomId = userRoomMap.get(socket.id);
    if (!roomId) return;

    socket.to(roomId).emit('screen-share-stopped', {
      userId: socket.id,
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

  // 💬 Chat message — now sends to both others AND the sender
  socket.on('chat-message', ({ roomId, message, sender }) => {
    if (!roomId || !message || !sender) return;

    console.log(`💬 Message from ${sender} in room ${roomId}: ${message}`);

    const payload = {
      userId: socket.id,
      sender,
      message,
      timestamp: Date.now(),
    };

    // Send to others
    socket.to(roomId).emit('chat-message', payload);

    // Send to sender
    socket.emit('chat-message', payload);
  });

  // 🚫 Kick participant (only trainers can kick)
  socket.on('kick-participant', ({ roomId, targetUserId, kickerName }) => {
    if (!roomId || !targetUserId) return;

    console.log(`🚫 ${socket.id} (${kickerName}) kicked participant ${targetUserId} from room ${roomId}`);

    // Check if the kicker is in the room
    const room = rooms.get(roomId);
    if (!room || !room.has(socket.id)) {
      console.log('❌ Kicker not found in room');
      return;
    }

    // Check if target user exists in the room
    if (!room.has(targetUserId)) {
      console.log('❌ Target user not found in room');
      return;
    }

    // Notify the target user that they've been kicked
    socket.to(targetUserId).emit('kicked-from-meeting', {
      kickerName: kickerName,
      roomId: roomId
    });

    // Track kicked user for 2-hour restriction
    const kickTime = new Date();
    const targetUserName = room.get(targetUserId);
    
    if (!kickedUsers.has(roomId)) {
      kickedUsers.set(roomId, new Map());
    }
    
    kickedUsers.get(roomId).set(targetUserName, {
      kickTime: kickTime.toISOString(),
      approved: false,
      kickedBy: kickerName
    });

    // Notify others in the room about the kick
    socket.to(roomId).emit('user-kicked', {
      userId: targetUserId,
      userName: targetUserName,
      kickerName: kickerName
    });

    // Also emit user-left to trigger WebRTC cleanup for all other participants
    socket.to(roomId).emit('user-left', { userId: targetUserId });

    // If the kicked user was screen sharing, notify others that screen sharing stopped
    socket.to(roomId).emit('screen-share-stopped', { userId: targetUserId });

    // Remove the user from the room data structures
    room.delete(targetUserId);
    userRoomMap.delete(targetUserId);
    
    // Force disconnect the target user from the room and close their socket connection
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) {
      targetSocket.leave(roomId);
      targetSocket.disconnect(true); // Force disconnect
    }
    
    console.log(`✅ User ${targetUserId} (${targetUserName}) kicked and disconnected from room ${roomId}`);
  });

  // 👨‍🏫 Trainer approve rejoin request
  socket.on('approve-rejoin', ({ roomId, displayName, userId }) => {
    if (!roomId || !displayName) return;

    console.log(`✅ Trainer approved rejoin for ${displayName} in room ${roomId}`);

    // Mark user as approved
    if (kickedUsers.has(roomId)) {
      const roomKickedUsers = kickedUsers.get(roomId);
      if (roomKickedUsers.has(displayName)) {
        roomKickedUsers.get(displayName).approved = true;
      }
    }

    // Notify the waiting user that they can now join
    socket.to(userId).emit('rejoin-approved', {
      roomId: roomId,
      message: 'Your request has been approved. You can now join the meeting.'
    });

    // Notify other trainers about the approval
    socket.to(roomId).emit('rejoin-approved-notification', {
      displayName: displayName,
      approvedBy: socket.id
    });
  });

  // 👨‍🏫 Trainer deny rejoin request
  socket.on('deny-rejoin', ({ roomId, displayName, userId }) => {
    if (!roomId || !displayName) return;

    console.log(`❌ Trainer denied rejoin for ${displayName} in room ${roomId}`);

    // Notify the waiting user that their request was denied
    socket.to(userId).emit('rejoin-denied', {
      message: 'Your request to rejoin has been denied by the trainer.'
    });
  });

  // 🏁 Meeting end (trainer only)
  socket.on('end-meeting', ({ roomId }) => {
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || !room.has(socket.id)) {
      console.log('❌ User not found in room or unauthorized');
      return;
    }

    console.log(`🏁 Meeting ${roomId} ended by trainer`);

    // Notify all participants that meeting has ended
    socket.to(roomId).emit('meeting-ended', {
      message: 'Meeting has been ended by the trainer.'
    });

    // Clear kicked users data for this room
    if (kickedUsers.has(roomId)) {
      kickedUsers.delete(roomId);
      console.log(`🗑️ Cleared kicked users data for room ${roomId}`);
    }

    // Remove all users from the room
    if (room) {
      room.forEach((displayName, socketId) => {
        const userSocket = io.sockets.sockets.get(socketId);
        if (userSocket) {
          userSocket.leave(roomId);
          userRoomMap.delete(socketId);
        }
      });
      rooms.delete(roomId);
    }

    console.log(`✅ Room ${roomId} completely cleaned up`);
  });

  // 👨‍🏫 Trainer approve entry request
  socket.on('approve-entry', ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    console.log(`✅ Trainer approved entry for user ${userId} in room ${roomId}`);

    // Find pending entry
    const pendingList = pendingEntries.get(roomId) || [];
    const pendingUser = pendingList.find(req => req.socketId === userId);
    
    if (pendingUser) {
      // Remove from pending list
      const updatedList = pendingList.filter(req => req.socketId !== userId);
      pendingEntries.set(roomId, updatedList);

      // Join the user to room
      const targetSocket = io.sockets.sockets.get(userId);
      if (targetSocket) {
        // Actually join the room
        targetSocket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        rooms.get(roomId).set(userId, pendingUser.displayName);
        userRoomMap.set(userId, roomId);

        // Notify others about new user
        targetSocket.to(roomId).emit('user-joined', {
          userId: userId,
          displayName: pendingUser.displayName,
        });

        // Send current users to the new joiner
        const users = Array.from(rooms.get(roomId))
          .filter(([id]) => id !== userId)
          .map(([id, name]) => ({ userId: id, displayName: name }));

        targetSocket.emit('room-users', { users });
        
        // Notify the user they can join
        targetSocket.emit('entry-approved', {
          roomId: roomId,
          message: 'Your request has been approved. You are now in the meeting!',
          success: true
        });
        
        console.log(`✅ User ${userId} (${pendingUser.displayName}) successfully joined room ${roomId}`);
      }
    }
  });

  // 👨‍🏫 Trainer deny entry request
  socket.on('deny-entry', ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    console.log(`❌ Trainer denied entry for user ${userId} in room ${roomId}`);

    // Find and remove pending entry
    const pendingList = pendingEntries.get(roomId) || [];
    const updatedList = pendingList.filter(req => req.socketId !== userId);
    pendingEntries.set(roomId, updatedList);

    // Notify the user their request was denied
    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.emit('entry-denied', {
        message: 'Your request to join has been denied by the trainer.'
      });
    }
  });
});

// Handle user leaving
function handleUserLeaveRoom(socket, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    const leavingUserName = room.get(socket.id);
    room.delete(socket.id);
    socket.to(roomId).emit('user-left', { userId: socket.id });

    // Check if the leaving user was a trainer
    const wasTrainer = leavingUserName && (
      leavingUserName.includes('(trainer)') || 
      leavingUserName.toLowerCase().includes('trainer')
    );

    if (room.size === 0) {
      // Room is empty, clean up everything
      rooms.delete(roomId);
      if (kickedUsers.has(roomId)) {
        kickedUsers.delete(roomId);
        console.log(`🗑️ Cleared kicked users data for empty room ${roomId}`);
      }
    } else if (wasTrainer) {
      // Trainer left, notify all participants and clean up kicked users
      socket.to(roomId).emit('trainer-left', {
        message: 'Trainer has left the meeting. Kicked user restrictions have been cleared.'
      });
      
      if (kickedUsers.has(roomId)) {
        kickedUsers.delete(roomId);
        console.log(`🗑️ Cleared kicked users data after trainer left room ${roomId}`);
      }
    }
  }
  socket.leave(roomId);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
