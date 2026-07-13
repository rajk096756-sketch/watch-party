/**
 * Socket.io Watch Party & WebRTC Signaling Handler
 * Coordinates synchronized video playback, text chat, room participants,
 * and WebRTC group signaling events.
 */

// Keeps track of room state (host, participants)
// roomId -> { hostSocketId: string, participants: [{ socketId, userId, username, cameraActive, micActive }] }
const rooms = {};

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    // Join room event
    socket.on('join-room', ({ roomId, userId, username }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        // First user to join becomes the host
        rooms[roomId] = {
          hostSocketId: socket.id,
          participants: []
        };
        console.log(`[SOCKET] Room ${roomId} created. Host is ${username} (${socket.id})`);
      }

      // Add user to participant list
      const room = rooms[roomId];
      const alreadyInRoom = room.participants.find(p => p.userId === userId);
      
      if (!alreadyInRoom) {
        room.participants.push({
          socketId: socket.id,
          userId,
          username,
          cameraActive: false,
          micActive: false,
          screenSharing: false
        });
      } else {
        // Update socket ID if reconnected
        alreadyInRoom.socketId = socket.id;
      }

      console.log(`[SOCKET] ${username} joined room: ${roomId}`);

      // Notify the room
      io.to(roomId).emit('room-participants', {
        hostSocketId: room.hostSocketId,
        participants: room.participants
      });

      // Let user know their role status
      socket.emit('role-status', {
        isHost: room.hostSocketId === socket.id
      });
    });

    // Synchronized Video State Broadcast
    // Triggered by host to sync play, pause, seek across all devices
    socket.on('video-sync', ({ roomId, playing, currentTime }) => {
      const room = rooms[roomId];
      if (room) {
        // Verification: only broadcast if socket is the designated host
        if (room.hostSocketId === socket.id) {
          socket.to(roomId).emit('video-sync-client', {
            playing,
            currentTime,
            timestamp: Date.now()
          });
        }
      }
    });

    // Chat messaging
    socket.on('chat-message', ({ roomId, message, username, userPlan }) => {
      io.to(roomId).emit('chat-message-client', {
        id: `chat-${Date.now()}-${Math.random()}`,
        message,
        username,
        userPlan,
        timestamp: new Date().toISOString()
      });
    });

    // WebRTC Signaling Relay
    // Relay SDP offers, answers, and ICE candidates between peers
    socket.on('webrtc-signal', ({ roomId, targetSocketId, signal }) => {
      // Direct relay to specific peer socket
      io.to(targetSocketId).emit('webrtc-signal-client', {
        senderSocketId: socket.id,
        signal
      });
    });

    // Media Status update (Mic / Camera toggle updates in UI list)
    socket.on('media-toggle', ({ roomId, cameraActive, micActive, screenSharing }) => {
      const room = rooms[roomId];
      if (room) {
        const participant = room.participants.find(p => p.socketId === socket.id);
        if (participant) {
          participant.cameraActive = cameraActive !== undefined ? cameraActive : participant.cameraActive;
          participant.micActive = micActive !== undefined ? micActive : participant.micActive;
          participant.screenSharing = screenSharing !== undefined ? screenSharing : participant.screenSharing;
          
          io.to(roomId).emit('room-participants', {
            hostSocketId: room.hostSocketId,
            participants: room.participants
          });
        }
      }
    });

    // Leave / Disconnect Event
    socket.on('disconnecting', () => {
      // Remove socket from room structures
      for (const roomId of socket.rooms) {
        const room = rooms[roomId];
        if (room) {
          room.participants = room.participants.filter(p => p.socketId !== socket.id);
          
          if (room.participants.length === 0) {
            // Delete room if empty
            delete rooms[roomId];
            console.log(`[SOCKET] Room ${roomId} deleted. Empty.`);
          } else {
            // If the host left, assign host to first remaining participant
            if (room.hostSocketId === socket.id) {
              const newHost = room.participants[0];
              room.hostSocketId = newHost.socketId;
              
              // Notify new host they have host controls
              io.to(newHost.socketId).emit('role-status', { isHost: true });
              console.log(`[SOCKET] Host left. New host is ${newHost.username} (${newHost.socketId})`);
            }
            
            // Broadcast updated state
            io.to(roomId).emit('room-participants', {
              hostSocketId: room.hostSocketId,
              participants: room.participants
            });
          }
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });
}
