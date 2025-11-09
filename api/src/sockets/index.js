import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { socketAuth } from './middleware/socketAuth.js';
import { connectionManager } from './managers/ConnectionManager.js';
import { messageQueue } from './managers/MessageQueue.js';
import { SendMessageCommand } from './commands/SendMessageCommand.js';
import { TypingCommand } from './commands/typingCommand.js';
import { pubClient, subClient } from '../config/redis.js';
import Conversation from '../models/Conversation.js';

/**
 * Initialize Socket.IO with modular architecture
 */
export const initializeSocket = (httpServer) => {
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(socketAuth);

  // Initialize command handlers
  const sendMessageCommand = new SendMessageCommand(io);
  const typingCommand = new TypingCommand(io);

  // Connection handler
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    console.log(`🔌 User connected: ${userId} (socket: ${socket.id})`);

    try {
      // Add connection
      await connectionManager.addConnection(userId, socket);

      // Flush queued messages for offline user
      const queuedMessages = await messageQueue.flush(userId);
      if (queuedMessages.length > 0) {
        socket.emit('messages:queued', { messages: queuedMessages });
        console.log(`📬 Delivered ${queuedMessages.length} queued messages to ${userId}`);
      }

      // Emit connection stats (optional - for debugging)
      socket.emit('connected', {
        userId,
        stats: connectionManager.getStats()
      });

      // ================== EVENT HANDLERS ==================

      /**
       * Create conversation (for testing)
       */
      socket.on('conversation:create', async (data) => {
        try {
          const { type, participantIds } = data;

          // Create conversation with the user as owner
          const conversation = await Conversation.create({
            type: type || 'direct',
            participants: [
              {
                user: userId,
                role: 'owner'
              }
            ],
            createdBy: userId
          });

          // Auto-join the conversation room
          socket.join(`conversation:${conversation._id}`);

          // Emit success
          socket.emit('conversation:created', {
            conversation: {
              _id: conversation._id,
              type: conversation.type,
              participants: conversation.participants,
              createdAt: conversation.createdAt
            }
          });

          console.log(`📂 Conversation created: ${conversation._id} by user ${userId}`);
        } catch (error) {
          console.error('conversation:create error:', error);
          socket.emit('error', {
            event: 'conversation:create',
            message: error.message
          });
        }
      });

      /**
       * Send message
       */
      socket.on('message:send', (data) => {
        sendMessageCommand.execute(socket, data);
      });

      /**
       * Typing indicators
       */
      socket.on('typing:start', (data) => {
        typingCommand.handleTypingStart(socket, data);
      });

      socket.on('typing:stop', (data) => {
        typingCommand.handleTypingStop(socket, data);
      });

      /**
       * Mark message as read
       */
      socket.on('message:read', async (data) => {
        try {
          const { messageId } = data;
          // Emit read receipt to sender
          socket.to(`user:${data.senderId}`).emit('message:read', {
            messageId,
            readBy: userId,
            readAt: new Date()
          });
        } catch (error) {
          console.error('message:read error:', error);
        }
      });

      /**
       * Join conversation room (for real-time updates)
       */
      socket.on('conversation:join', (data) => {
        const { conversationId } = data;
        socket.join(`conversation:${conversationId}`);
        console.log(`📂 User ${userId} joined conversation: ${conversationId}`);
      });

      /**
       * Leave conversation room
       */
      socket.on('conversation:leave', (data) => {
        const { conversationId } = data;
        socket.leave(`conversation:${conversationId}`);
        console.log(`📂 User ${userId} left conversation: ${conversationId}`);
      });

      /**
       * Disconnect handler
       */
      socket.on('disconnect', async (reason) => {
        console.log(`❌ User disconnected: ${userId} (${reason})`);
        await connectionManager.removeConnection(userId, socket.id);
      });

    } catch (error) {
      console.error('Socket connection error:', error);
      socket.disconnect();
    }
  });

  // ================== UTILITY FUNCTIONS ==================

  /**
   * Broadcast to specific users
   */
  io.broadcastToUsers = (userIds, event, data) => {
    userIds.forEach(userId => {
      const sockets = connectionManager.getUserSockets(userId);
      sockets.forEach(socket => socket.emit(event, data));
    });
  };

  /**
   * Broadcast to conversation
   */
  io.broadcastToConversation = (conversationId, event, data) => {
    io.to(`conversation:${conversationId}`).emit(event, data);
  };

  console.log('✅ Socket.IO initialized with modular architecture');
  return io;
};
