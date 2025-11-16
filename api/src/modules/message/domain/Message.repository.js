import Message from "../../../models/Message.js";
import Conversation from "../../../models/Conversation.js";

/**
 * Message Repository - Data access layer for message operations
 * Isolates Mongoose queries from business logic
 */
export class MessageRepository {
  constructor() {
    this.messageModel = Message;
    this.conversationModel = Conversation;
  }

  /**
   * Create a new message
   */
  async create(messageData) {
    const message = new this.messageModel(messageData);
    await message.save();
    return message;
  }

  /**
   * Find message by ID with population
   */
  async findById(messageId, populateOptions = {}) {
    let query = this.messageModel.findById(messageId);

    if (populateOptions.sender) {
      query = query.populate("sender", "username displayName avatar");
    }

    return query.exec();
  }

  /**
   * Find messages in a conversation with pagination
   */
  async findByConversation(conversationId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversation: conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "username displayName avatar")
      .exec();

    const total = await this.messageModel.countDocuments({
      conversation: conversationId,
    });

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update message status (sent, delivered, read)
   */
  async updateStatus(messageId, status) {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      { status, [`timestamps.${status}At`]: new Date() },
      { new: true }
    );
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId, userId) {
    const message = await this.messageModel.findById(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Only mark as read if user is not the sender
    if (message.sender.toString() !== userId.toString()) {
      message.status = "read";
      message.timestamps.readAt = new Date();
      await message.save();
    }

    return message;
  }

  /**
   * Mark multiple messages as read
   */
  async markMultipleAsRead(conversationId, userId) {
    return this.messageModel.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        status: { $ne: "read" },
      },
      {
        status: "read",
        "timestamps.readAt": new Date(),
      }
    );
  }

  /**
   * Soft delete message (if you implement soft delete)
   */
  async softDelete(messageId, userId) {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $push: { deletedFor: userId },
        deletedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId) {
    // Find all conversations where user is a participant
    const conversations = await this.conversationModel
      .find({
        participants: userId,
      })
      .select("_id");

    const conversationIds = conversations.map((c) => c._id);

    // Count unread messages in those conversations
    return this.messageModel.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId },
      status: { $ne: "read" },
    });
  }

  /**
   * Search messages in conversation
   */
  async searchInConversation(conversationId, searchTerm) {
    return this.messageModel
      .find({
        conversation: conversationId,
        $or: [{ "content.text": { $regex: searchTerm, $options: "i" } }],
      })
      .populate("sender", "username displayName avatar")
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }
}
