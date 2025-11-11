// api/src/sockets/index.js
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { socketAuth } from "./middleware/socketAuth.js";
import { sanitizeSocketInput } from "../middleware/socketSanitizer.js";
import { connectionManager } from "./managers/ConnectionManager.js";
import { messageQueue } from "./managers/MessageQueue.js";
import { SendMessageCommand } from "./commands/SendMessageCommand.js";
import { TypingCommand } from "./commands/typingCommand.js";
import { pubClient, subClient } from "../config/redis.js";
import { messageService } from "../services/message.service.js";
import {
  createMessageDeliveryWorker,
  getQueueStats,
} from "../queues/messageDeliveryQueue.js";
import Conversation from "../models/Conversation.js";

/**
 * Initialize Socket.IO with complete scalability setup
 */
export const initializeSocket = (httpServer) => {
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
    cookie: {
      name: "io",
      path: "/",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,

    // Compression settings
    perMessageDeflate: {
      threshold: 1024,
      zlibDeflateOptions: {
        level: 6,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
    },

    httpCompression: {
      threshold: 1024,
      zlibDeflateOptions: {
        level: 6,
      },
    },
  });

  // ============ REDIS ADAPTER ============
  io.adapter(createAdapter(pubClient, subClient));
  console.log("✅ Socket.IO Redis adapter configured for horizontal scaling");

  // ============ ERROR HANDLING FOR REDIS ADAPTER ============
  pubClient.on("error", (err) => {
    console.error("❌ Socket.IO Redis Pub Client Error:", err);
  });

  subClient.on("error", (err) => {
    console.error("❌ Socket.IO Redis Sub Client Error:", err);
  });

  // ============ INITIALIZE BULLMQ WORKER ============
  const messageDeliveryWorker = createMessageDeliveryWorker(io);
  console.log("✅ BullMQ message delivery worker started");

  // Store worker reference for graceful shutdown
  io.worker = messageDeliveryWorker;

  // ============ CROSS-INSTANCE PUB/SUB ============
  const crossInstanceSubscriber = connectionManager.subscribeToEmits(io);
  console.log("✅ Cross-instance pub/sub subscribed");

  // Store subscriber for cleanup
  io.crossInstanceSubscriber = crossInstanceSubscriber;

  // ============ PERIODIC CLEANUP ============
  const cleanupInterval = setInterval(() => {
    connectionManager.cleanupOrphanedConnections();
  }, 60000); // Every minute

  // Store interval for cleanup
  io.cleanupInterval = cleanupInterval;

  // ============ MIDDLEWARE ============
  io.use(socketAuth);
  io.use(sanitizeSocketInput);

  // ============ COMMAND HANDLERS ============
  const sendMessageCommand = new SendMessageCommand(io);
  const typingCommand = new TypingCommand(io);

  // ============ CONNECTION HANDLER ============
  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User connected: ${userId} (socket: ${socket.id})`);

    try {
      // Add connection to Redis-backed manager
      await connectionManager.addConnection(userId, socket);

      // Flush queued messages
      const queuedMessages = await messageQueue.flush(userId);
      if (queuedMessages.length > 0) {
        socket.emit("messages:queued", { messages: queuedMessages });
        console.log(
          `📬 Delivered ${queuedMessages.length} queued messages to ${userId}`
        );
      }

      // Get connection stats
      const stats = await connectionManager.getStats();
      const queueStats = await getQueueStats();

      // Emit connection confirmation with stats
      socket.emit("connected", {
        userId,
        socketId: socket.id,
        instanceId: connectionManager.instanceId,
        stats: {
          ...stats,
          queue: queueStats,
        },
      });

      // ================== MESSAGE EVENTS ==================

      /**
       * Send message - now with retry queue
       */
      socket.on("message:send", async (data) => {
        await sendMessageCommand.execute(socket, data);
      });

      /**
       * Load paginated messages
       */
      socket.on("messages:load", async (data) => {
        try {
          const { conversationId, before, limit = 50 } = data;

          // Verify user has access to conversation
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (!conversation) {
            return socket.emit("error", {
              event: "messages:load",
              message: "Conversation not found",
            });
          }

          const isParticipant = conversation.participants.some(
            (p) => p.user.toString() === userId
          );

          if (!isParticipant) {
            return socket.emit("error", {
              event: "messages:load",
              message: "Access denied",
            });
          }

          // Load messages with pagination and projection
          const result = await messageService.getMessagesPaginated(
            conversationId,
            {
              before,
              limit: Math.min(limit, 100),
            }
          );

          socket.emit("messages:loaded", result);
        } catch (error) {
          console.error("Load messages error:", error);
          socket.emit("error", {
            event: "messages:load",
            message: error.message,
          });
        }
      });

      /**
       * Mark message as read
       */
      socket.on("message:read", async (data) => {
        try {
          const { messageId, conversationId } = data;

          // Update database (you'll need to implement this in message.service.js)
          await messageService.markAsRead(messageId, userId);

          // Emit read receipt via cross-instance pub/sub
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (conversation) {
            const otherParticipants = conversation.participants
              .map((p) => p.user.toString())
              .filter((id) => id !== userId);

            // Emit to other participants across all instances
            for (const participantId of otherParticipants) {
              await connectionManager.emitToUser(
                participantId,
                "message:read",
                {
                  messageId,
                  conversationId,
                  readBy: userId,
                  readAt: new Date(),
                }
              );
            }
          }
        } catch (error) {
          console.error("message:read error:", error);
        }
      });

      // ================== 🆕 PHASE 3: EDIT/DELETE/REACTIONS ==================

      /**
       * ✏️ Edit message
       */
      socket.on("message:edit", async (data) => {
        try {
          const { messageId, content, conversationId } = data;

          console.log("🚀 ~ message:edit ~ messageId:", messageId);
          console.log("🚀 ~ message:edit ~ content:", content);

          // Edit the message
          const message = await messageService.editMessage(
            messageId,
            userId,
            content
          );

          // Get conversation to notify participants
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (!conversation) {
            return socket.emit("error", {
              event: "message:edit",
              message: "Conversation not found",
            });
          }

          // Emit to all participants (including sender for multi-device sync)
          const allParticipants = conversation.participants.map((p) =>
            p.user.toString()
          );

          for (const participantId of allParticipants) {
            await connectionManager.emitToUser(
              participantId,
              "message:edited",
              {
                messageId: message._id,
                conversationId,
                content: message.content,
                edited: message.edited,
                updatedAt: message.updatedAt,
              }
            );
          }

          // Acknowledge to sender
          socket.emit("message:edit:success", {
            messageId: message._id,
            conversationId,
          });
        } catch (error) {
          console.error("message:edit error:", error);
          socket.emit("error", {
            event: "message:edit",
            message: error.message,
          });
        }
      });

      /**
       * 🗑️ Delete message (for current user)
       */
      socket.on("message:delete", async (data) => {
        try {
          const { messageId, conversationId } = data;

          console.log("🚀 ~ message:delete ~ messageId:", messageId);

          // Delete message for user
          await messageService.deleteMessage(messageId, userId);

          // Only notify the user who deleted it (per-user delete)
          socket.emit("message:deleted", {
            messageId,
            conversationId,
            deletedFor: userId,
          });
        } catch (error) {
          console.error("message:delete error:", error);
          socket.emit("error", {
            event: "message:delete",
            message: error.message,
          });
        }
      });

      /**
       * 🗑️ Delete message for everyone (sender only, within 1 hour)
       */
      socket.on("message:delete:everyone", async (data) => {
        try {
          const { messageId, conversationId } = data;

          console.log("🚀 ~ message:delete:everyone ~ messageId:", messageId);

          // Delete message for everyone
          const message = await messageService.deleteMessageForEveryone(
            messageId,
            userId
          );

          // Get conversation to notify all participants
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (!conversation) {
            return socket.emit("error", {
              event: "message:delete:everyone",
              message: "Conversation not found",
            });
          }

          // Emit to all participants
          const allParticipants = conversation.participants.map((p) =>
            p.user.toString()
          );

          for (const participantId of allParticipants) {
            await connectionManager.emitToUser(
              participantId,
              "message:deleted:everyone",
              {
                messageId: message._id,
                conversationId,
                deletedBy: userId,
                deletedAt: message.deletedAt || new Date(),
              }
            );
          }
        } catch (error) {
          console.error("message:delete:everyone error:", error);
          socket.emit("error", {
            event: "message:delete:everyone",
            message: error.message,
          });
        }
      });

      /**
       * 😀 Add reaction to message
       */
      socket.on("message:react", async (data) => {
        try {
          const { messageId, emoji, conversationId } = data;

          console.log("🚀 ~ message:react ~ messageId:", messageId);
          console.log("🚀 ~ message:react ~ emoji:", emoji);

          // Add reaction
          const message = await messageService.addReaction(
            messageId,
            userId,
            emoji
          );

          // Get conversation to notify participants
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (!conversation) {
            return socket.emit("error", {
              event: "message:react",
              message: "Conversation not found",
            });
          }

          // Emit to all participants
          const allParticipants = conversation.participants.map((p) =>
            p.user.toString()
          );

          for (const participantId of allParticipants) {
            await connectionManager.emitToUser(
              participantId,
              "message:reaction",
              {
                messageId: message._id,
                conversationId,
                reactions: message.reactions,
                addedBy: userId,
                emoji,
              }
            );
          }
        } catch (error) {
          console.error("message:react error:", error);
          socket.emit("error", {
            event: "message:react",
            message: error.message,
          });
        }
      });

      /**
       * 🚫 Remove reaction from message
       */
      socket.on("message:unreact", async (data) => {
        try {
          const { messageId, emoji, conversationId } = data;

          console.log("🚀 ~ message:unreact ~ messageId:", messageId);
          console.log("🚀 ~ message:unreact ~ emoji:", emoji);

          // Remove reaction
          const message = await messageService.removeReaction(
            messageId,
            userId,
            emoji
          );

          // Get conversation to notify participants
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (!conversation) {
            return socket.emit("error", {
              event: "message:unreact",
              message: "Conversation not found",
            });
          }

          // Emit to all participants
          const allParticipants = conversation.participants.map((p) =>
            p.user.toString()
          );

          for (const participantId of allParticipants) {
            await connectionManager.emitToUser(
              participantId,
              "message:reaction",
              {
                messageId: message._id,
                conversationId,
                reactions: message.reactions,
                removedBy: userId,
                emoji,
              }
            );
          }
        } catch (error) {
          console.error("message:unreact error:", error);
          socket.emit("error", {
            event: "message:unreact",
            message: error.message,
          });
        }
      });

      /**
       * 📬 Mark message as delivered
       */
      socket.on("message:delivered", async (data) => {
        try {
          const { messageId, conversationId } = data;

          await messageService.markAsDelivered(messageId, userId);

          // Get message sender to notify them
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();

          if (conversation) {
            const otherParticipants = conversation.participants
              .map((p) => p.user.toString())
              .filter((id) => id !== userId);

            for (const participantId of otherParticipants) {
              await connectionManager.emitToUser(
                participantId,
                "message:delivered",
                {
                  messageId,
                  conversationId,
                  deliveredTo: userId,
                  deliveredAt: new Date(),
                }
              );
            }
          }
        } catch (error) {
          console.error("message:delivered error:", error);
        }
      });

      // ================== TYPING EVENTS ==================

      // ================== TYPING EVENTS ==================

      socket.on("typing:start", async (data) => {
        await typingCommand.handleTypingStart(socket, data);
      });

      socket.on("typing:stop", async (data) => {
        await typingCommand.handleTypingStop(socket, data);
      });

      // ================== CONVERSATION EVENTS ==================

      /**
       * Join conversation room
       */
      socket.on("conversation:join", (data) => {
        const { conversationId } = data;
        socket.join(`conversation:${conversationId}`);
        console.log(`📂 User ${userId} joined conversation: ${conversationId}`);
      });

      /**
       * Leave conversation room
       */
      socket.on("conversation:leave", (data) => {
        const { conversationId } = data;
        socket.leave(`conversation:${conversationId}`);
        console.log(`📂 User ${userId} left conversation: ${conversationId}`);
      });

      // ================== PRESENCE EVENTS ==================

      /**
       * Request presence information for multiple users
       */
      socket.on("presence:request", async (data) => {
        try {
          const { userIds } = data;

          if (!Array.isArray(userIds) || userIds.length === 0) {
            return socket.emit("error", {
              event: "presence:request",
              message: "userIds must be a non-empty array",
            });
          }

          // Get bulk presence from Redis
          const presence = await connectionManager.getBulkPresence(userIds);

          socket.emit("presence:update", { presence });
        } catch (error) {
          console.error("presence:request error:", error);
          socket.emit("error", {
            event: "presence:request",
            message: error.message,
          });
        }
      });

      /**
       * Subscribe to user presence updates
       */
      socket.on("presence:subscribe", async (data) => {
        try {
          const { userIds } = data;

          if (!Array.isArray(userIds)) {
            return socket.emit("error", {
              event: "presence:subscribe",
              message: "userIds must be an array",
            });
          }

          // Join presence rooms for these users
          userIds.forEach((uid) => {
            socket.join(`presence:${uid}`);
          });

          console.log(
            `👁️ User ${userId} subscribed to ${userIds.length} presence updates`
          );
        } catch (error) {
          console.error("presence:subscribe error:", error);
        }
      });

      // ================== STATS & DEBUG EVENTS ==================

      /**
       * Get server statistics (optional - for admin/debug)
       */
      socket.on("stats:request", async (data) => {
        try {
          const stats = await connectionManager.getStats();
          const queueStats = await getQueueStats();

          socket.emit("stats:update", {
            connections: stats,
            queue: queueStats,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error("stats:request error:", error);
        }
      });

      // ================== DISCONNECT HANDLER ==================

      socket.on("disconnect", async (reason) => {
        console.log(`❌ User disconnected: ${userId} (${reason})`);

        try {
          await connectionManager.removeConnection(userId, socket.id);

          // Notify other users about presence change
          // You can implement this based on your needs
          io.emit(`presence:${userId}`, {
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
        } catch (error) {
          console.error("Disconnect handler error:", error);
        }
      });

      // ================== ERROR HANDLER ==================

      socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.emit("error", {
        event: "connection",
        message: "Failed to establish connection",
      });
      socket.disconnect();
    }
  });

  // ============ GLOBAL ERROR HANDLERS ============

  io.engine.on("connection_error", (err) => {
    console.error("❌ Socket.IO connection error:", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  // ============ UTILITY FUNCTIONS ============

  /**
   * Broadcast to specific users (cross-instance via pub/sub)
   */
  io.broadcastToUsers = async (userIds, event, data) => {
    for (const userId of userIds) {
      await connectionManager.emitToUser(userId, event, data);
    }
  };

  /**
   * Broadcast to conversation room
   */
  io.broadcastToConversation = (conversationId, event, data) => {
    io.to(`conversation:${conversationId}`).emit(event, data);
  };

  /**
   * Broadcast presence update
   */
  io.broadcastPresence = (userId, presenceData) => {
    io.to(`presence:${userId}`).emit("presence:update", {
      userId,
      ...presenceData,
    });
  };

  /**
   * Get connection statistics (async version)
   */
  io.getStats = async () => {
    const [connectionStats, queueStats] = await Promise.all([
      connectionManager.getStats(),
      getQueueStats(),
    ]);

    return {
      connections: connectionStats,
      queue: queueStats,
    };
  };

  // ============ GRACEFUL SHUTDOWN ============

  const gracefulShutdown = async () => {
    console.log("⏳ Shutting down Socket.IO gracefully...");

    try {
      // Stop accepting new connections
      io.close();

      // Clear cleanup interval
      if (io.cleanupInterval) {
        clearInterval(io.cleanupInterval);
      }

      // Close worker
      if (io.worker) {
        await io.worker.close();
        console.log("✅ BullMQ worker closed");
      }

      // Close cross-instance subscriber
      if (io.crossInstanceSubscriber) {
        await io.crossInstanceSubscriber.quit();
        console.log("✅ Cross-instance subscriber closed");
      }

      console.log("✅ Socket.IO shutdown complete");
    } catch (error) {
      console.error("❌ Error during Socket.IO shutdown:", error);
    }
  };

  // Listen for shutdown signals
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  console.log("✅ Socket.IO initialized with full scalability support");
  console.log(`📍 Instance ID: ${connectionManager.instanceId}`);

  return io;
};
