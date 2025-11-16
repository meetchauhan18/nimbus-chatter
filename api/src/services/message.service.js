import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { NotFoundError, BadRequestError } from "../shared/errors/index.js";
import mongoose from "mongoose";

/**
 * Message Service
 * Handles all message-related business logic
 */
export class MessageService {
  /**
   * Create a new message
   */
  async createMessage({
    senderId,
    conversationId,
    content,
    type = "text",
    metadata = {},
    replyTo = null,
  }) {
    // Validate conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    // Verify sender is a participant
    const isSenderInConversation = conversation.participants.some(
      (p) => p.user.toString() === senderId
    );

    if (!isSenderInConversation) {
      throw new BadRequestError(
        "You are not a participant in this conversation"
      );
    }

    const message = await Message.create({
      clientMsgId: `${senderId}_${Date.now()}_${Math.random().toString(36)}`,
      conversationId,
      senderId,
      content,
      type,
      metadata: metadata || {},
      status: "sent",
      replyTo,
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    await message.populate("senderId", "displayName avatar phone username");

    if (replyTo) {
      await message.populate({
        path: "replyTo",
        select: "content senderId type",
        populate: { path: "senderId", select: "displayName avatar" },
      });
    }

    return message;
  }

  /**
   * Get messages for a conversation (with pagination)
   */
  async getMessages(conversationId, userId, { before = null, limit = 50 }) {
    const query = {
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: userId }, // Exclude messages deleted by this user
    };

    // Cursor-based pagination
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "displayName avatar phone username")
      .populate({
        path: "replyTo",
        select: "content senderId type",
        populate: { path: "senderId", select: "displayName avatar" },
      })
      .populate("reactions.userId", "displayName avatar")
      .lean();

    return {
      messages,
      nextCursor:
        messages.length > 0 ? messages[messages.length - 1]._id : null,
      hasMore: messages.length === limit,
    };
  }

  /**
   * Get messages with pagination (optimized)
   */
  async getMessagesPaginated(conversationId, userId, options = {}) {
    const { limit = 50, before, after, includeDeleted = false } = options;

    // Build query
    const query = {
      conversationId: mongoose.Types.ObjectId(conversationId),
      deletedFor: { $ne: userId }, // Exclude user-deleted messages
    };

    // Exclude system-deleted messages unless requested
    if (!includeDeleted) {
      query.isDeleted = false;
    }

    // Cursor-based pagination
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    } else if (after) {
      query.createdAt = { $gt: new Date(after) };
    }

    const messages = await Message.find(query)
      .select({
        content: 1,
        type: 1,
        senderId: 1,
        createdAt: 1,
        updatedAt: 1,
        status: 1,
        metadata: 1,
        media: 1,
        replyTo: 1,
        reactions: 1,
        edited: 1,
        deliveredTo: 1,
        seenBy: 1,
        isDeleted: 1,
      })
      .sort({ createdAt: before ? -1 : 1 })
      .limit(limit + 1)
      .populate({
        path: "senderId",
        select: "displayName avatar phone username",
      })
      .populate({
        path: "replyTo",
        select: "content senderId type createdAt",
        populate: {
          path: "senderId",
          select: "displayName avatar",
        },
      })
      .populate("reactions.userId", "displayName avatar")
      .lean();

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;

    if (before) {
      result.reverse();
    }

    return {
      messages: result,
      hasMore,
      cursor:
        result.length > 0
          ? result[result.length - 1].createdAt.toISOString()
          : null,
      count: result.length,
    };
  }

  /**
   * Mark message as delivered
   */
  async markAsDelivered(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    // Don't mark sender's own message
    if (message.senderId.toString() === userId.toString()) {
      return message;
    }

    message.markDelivered(userId); // Use model method
    await message.save();

    return message;
  }

  /**
   * Mark message as seen/read
   */
  async markAsRead(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    // Don't mark sender's own message
    if (message.senderId.toString() === userId.toString()) {
      return message;
    }

    message.markSeen(userId); // Use model method
    await message.save();

    return message;
  }

  /**
   * Mark all conversation messages as read
   */
  async markConversationAsRead(conversationId, userId) {
    const result = await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        "seenBy.userId": { $ne: userId },
        isDeleted: false,
      },
      {
        $push: { seenBy: { userId, timestamp: new Date() } },
        $set: { status: "seen" },
      }
    );

    return result;
  }

  /**
   * Edit message (uses model's canEdit method)
   */
  async editMessage(messageId, userId, newContent) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    // Use model's canEdit method
    if (!message.canEdit(userId)) {
      throw new BadRequestError(
        "Cannot edit this message. Only sender can edit within 15 minutes."
      );
    }

    message.content = newContent;
    // Middleware will handle setting edited flags
    await message.save();

    await message.populate("senderId", "displayName avatar phone username");

    return message;
  }

  /**
   * Delete message for user (soft delete)
   */
  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (!message.canDelete(userId)) {
      throw new BadRequestError("You can only delete your own messages");
    }

    message.deleteForUser(userId); // Use model method
    await message.save();

    return message;
  }

  /**
   * Permanently delete message (sender only, deletes for everyone)
   */
  async deleteMessageForEveryone(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.senderId.toString() !== userId.toString()) {
      throw new BadRequestError("Only sender can delete for everyone");
    }

    // Check time limit (e.g., 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (message.createdAt < oneHourAgo) {
      throw new BadRequestError(
        "Can only delete for everyone within 1 hour of sending"
      );
    }

    message.permanentDelete(); // Use model method
    await message.save();

    return message;
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId, userId, emoji) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.isDeleted) {
      throw new BadRequestError("Cannot react to deleted message");
    }

    message.addReaction(userId, emoji); // Use model method
    await message.save();

    await message.populate("reactions.userId", "displayName avatar username");

    return message;
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(messageId, userId, emoji) {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    message.removeReaction(userId, emoji); // Use model method
    await message.save();

    return message;
  }

  /**
   * Get message by ID with full details
   */
  async getMessageById(messageId, userId) {
    const message = await Message.findOne({
      _id: messageId,
      deletedFor: { $ne: userId },
    })
      .populate("senderId", "displayName avatar phone username")
      .populate({
        path: "replyTo",
        select: "content senderId type",
        populate: { path: "senderId", select: "displayName avatar" },
      })
      .populate("reactions.userId", "displayName avatar");

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return message;
  }
}

// Singleton instance
export const messageService = new MessageService();
