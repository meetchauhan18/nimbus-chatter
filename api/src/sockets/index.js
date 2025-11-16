// api/src/sockets/index.js
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { socketAuth } from "./middleware/socketAuth.js";
import { sanitizeSocketInput } from "../middleware/socketSanitizer.js";
import ConnectionManager from "./managers/ConnectionManager.js";
import MessageQueue from "./managers/MessageQueue.js";
import { userService } from "../services/user.service.js";
import { createMessageDeliveryWorker } from "../queues/messageDeliveryQueue.js";
import Conversation from "../models/Conversation.js";
import { config } from "../shared/config/index.js";

export const initializeSocket = (server, pubClient, subClient, cacheClient) => {
  const connectionManager = new ConnectionManager(cacheClient);
  const messageQueue = new MessageQueue(cacheClient);

  // Create Socket.IO server
  const io = new Server(server, {
    cors: {
      origin: config?.client?.url || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6,
    allowEIO3: true,
  });

  // Use Redis adapter with PROVIDED clients (not creating new ones)
  io.adapter(createAdapter(pubClient, subClient));

  console.log("✅ Socket.IO initialized with Redis adapter");

  // Authentication middleware
  io.use(socketAuth);

  // Input sanitization middleware
  io.use(sanitizeSocketInput);

  // Connection handler
  io.on("connection", async (socket) => {
    const userId = socket.user?.userId;
    const userEmail = socket.user?.email;

    if (!userId) {
      console.error("❌ Socket connection rejected: No userId");
      socket.disconnect(true);
      return;
    }

    console.log(`✅ User connected: ${userEmail} (${userId})`);

    // Register connection
    connectionManager.addConnection(userId, socket.id);

    // Update user online status
    await userService.updateOnlineStatus(userId, true);

    // Emit online status to user's contacts
    const conversations = await Conversation.find({
      "participants.user": userId,
    }).populate("participants.user", "_id");

    const contactIds = conversations
      .flatMap((conv) => conv.participants.map((p) => p.user._id.toString()))
      .filter((id) => id !== userId);

    const uniqueContactIds = [...new Set(contactIds)];
    uniqueContactIds.forEach((contactId) => {
      io.to(contactId).emit("user:online", { userId });
    });

    // Join user's personal room
    socket.join(userId);

    // Join all conversation rooms
    const userConversations = await Conversation.find({
      "participants.user": userId,
    });

    userConversations.forEach((conv) => {
      socket.join(conv._id.toString());
    });

    console.log(
      `📢 User ${userId} joined ${userConversations.length} conversation rooms`
    );

    // ... REST OF YOUR SOCKET HANDLERS (sendMessage, typing, etc.)
    // Keep everything else the same, just remove any new Redis() calls

    // Disconnect handler
    socket.on("disconnect", async (reason) => {
      console.log(`❌ User disconnected: ${userEmail} - Reason: ${reason}`);
      connectionManager.removeConnection(userId, socket.id);

      const isUserFullyDisconnected = !connectionManager.isUserOnline(userId);

      if (isUserFullyDisconnected) {
        await userService.updateOnlineStatus(userId, false);

        uniqueContactIds.forEach((contactId) => {
          io.to(contactId).emit("user:offline", {
            userId,
            lastSeen: new Date(),
          });
        });
      }
    });
  });

  // Initialize message delivery worker
  createMessageDeliveryWorker(io, connectionManager);

  return io;
};
