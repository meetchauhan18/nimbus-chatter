export class TypingCommand {
  constructor(io, connectionManager) {
    this.io = io;
    this.connectionManager = connectionManager;
  }

  async execute(socket, data) {
    try {
      const { conversationId, isTyping } = data;
      const userId = socket.user.userId;
      const username = socket.user.username || socket.user.email;

      // Validate required fields
      if (!conversationId || typeof isTyping !== "boolean") {
        socket.emit("error", {
          message: "Conversation ID and typing status are required",
          code: "INVALID_TYPING_DATA",
        });
        return;
      }

      // Verify user is participant of conversation
      const Conversation = (await import("../../models/Conversation.js"))
        .default;
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.user": userId,
      });

      if (!conversation) {
        socket.emit("error", {
          message: "Conversation not found or access denied",
          code: "CONVERSATION_NOT_FOUND",
        });
        return;
      }

      // Get all participants except the sender
      const recipientIds = conversation.participants
        .map((p) => p.user.toString())
        .filter((id) => id !== userId.toString());

      // Emit typing status to all recipients' sockets
      for (const recipientId of recipientIds) {
        const recipientSockets =
          await this.connectionManager.getUserSockets(recipientId);

        recipientSockets.forEach((socketId) => {
          this.io.to(socketId).emit("typing:status", {
            conversationId,
            userId,
            username,
            isTyping,
          });
        });
      }

      // Cache typing status in Redis with TTL
      const cacheKey = `typing:${conversationId}:${userId}`;
      if (isTyping) {
        await this.connectionManager.redis.setex(cacheKey, 5, "typing");
      } else {
        await this.connectionManager.redis.del(cacheKey);
      }

      console.log(
        `👀 User ${userId} ${isTyping ? "started" : "stopped"} typing in ${conversationId}`
      );
    } catch (error) {
      console.error("❌ TypingCommand Error:", error);

      socket.emit("error", {
        message: "Failed to update typing status",
        code: "TYPING_STATUS_FAILED",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}
