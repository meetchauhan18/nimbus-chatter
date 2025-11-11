import Conversation from "../../models/Conversation.js";
import { messageService } from "../../services/message.service.js";
import { messageDeliveryQueue } from "../../queues/messageDeliveryQueue.js";

export class SendMessageCommand {
  constructor(io, connectionManager) {
    this.io = io;
    this.connectionManager = connectionManager;
  }

  async execute(socket, data) {
    try {
      const { conversationId, content, type = "text" } = data;
      const senderId = socket.user.userId;

      // Validate required fields
      if (!conversationId || !content) {
        socket.emit("error", {
          message: "Conversation ID and content are required",
          code: "MISSING_FIELDS",
        });
        return;
      }

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.user": senderId,
      });

      if (!conversation) {
        socket.emit("error", {
          message: "Conversation not found or access denied",
          code: "CONVERSATION_NOT_FOUND",
        });
        return;
      }

      // Create message using service
      const message = await messageService.createMessage({
        conversationId,
        senderId,
        content,
        type,
      });

      // Populate sender details
      await message.populate("senderId", "displayName avatar username email");

      // Update conversation's last message
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      // Get recipient IDs (all participants except sender)
      const recipientIds = conversation.participants
        .map((p) => p.user.toString())
        .filter((id) => id !== senderId.toString());

      // Emit to sender's all devices immediately
      const senderSocketIds =
        await this.connectionManager.getUserSockets(senderId);
      senderSocketIds.forEach((socketId) => {
        this.io.to(socketId).emit("message:new", {
          message: message.toObject(),
          conversationId,
        });
      });

      // Queue message delivery for each recipient
      for (const recipientId of recipientIds) {
        await messageDeliveryQueue.add("deliver-message", {
          messageId: message._id.toString(),
          recipientId,
          conversationId,
        });
      }

      // Mark message as sent
      message.status = "sent";
      await message.save();

      // Emit delivery status update to sender
      senderSocketIds.forEach((socketId) => {
        this.io.to(socketId).emit("message:status", {
          messageId: message._id,
          status: "sent",
        });
      });

      console.log(
        `✅ Message ${message._id} queued for ${recipientIds.length} recipients`
      );
    } catch (error) {
      console.error("❌ SendMessageCommand Error:", error);

      // Send error to client
      socket.emit("error", {
        message: "Failed to send message",
        code: "MESSAGE_SEND_FAILED",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}
