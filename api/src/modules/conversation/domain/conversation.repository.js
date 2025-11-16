import Conversation from "../../../models/Conversation.js";

/**
 * Conversation Repository
 * Handles all database queries for conversations
 */
export class ConversationRepository {
  constructor() {
    this.conversationModel = Conversation;
  }

  /**
   * Find user's conversations with pagination
   */
  async findByUser(userId, { limit = 50, offset = 0 } = {}) {
    return this.conversationModel
      .find({
        "participants.user": userId,
        isDeleted: false,
      })
      .populate("participants.user", "displayName avatar email username")
      .populate({
        path: "lastMessage",
        select: "content sender createdAt type",
        populate: {
          path: "sender",
          select: "displayName avatar username",
        },
      })
      .sort({ lastMessageAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * Find conversation by ID
   */
  async findById(conversationId, userId = null) {
    const query = {
      _id: conversationId,
      isDeleted: false,
    };

    // If userId provided, verify they're a participant
    if (userId) {
      query["participants.user"] = userId;
    }

    return this.conversationModel
      .findOne(query)
      .populate("participants.user", "displayName avatar email username status")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "displayName avatar username",
        },
      })
      .exec();
  }

  /**
   * Find direct conversation between two users
   */
  async findDirectConversation(userIds) {
    return this.conversationModel
      .findOne({
        type: "direct",
        "participants.user": { $all: userIds },
        isDeleted: false,
      })
      .populate("participants.user", "displayName avatar email username")
      .exec();
  }

  /**
   * Create new conversation
   */
  async create(data) {
    const conversation = new this.conversationModel(data);
    await conversation.save();

    // Populate user details
    await conversation.populate(
      "participants.user",
      "displayName avatar email username"
    );

    return conversation;
  }

  /**
   * Update conversation
   */
  async update(conversationId, updates) {
    return this.conversationModel
      .findByIdAndUpdate(conversationId, updates, { new: true })
      .populate("participants.user", "displayName avatar email username")
      .exec();
  }

  /**
   * Delete conversation (soft delete)
   */
  async softDelete(conversationId) {
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Add participants to conversation
   */
  async addParticipants(conversationId, participantData) {
    return this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { $push: { participants: { $each: participantData } } },
        { new: true }
      )
      .populate("participants.user", "displayName avatar email username");
  }

  /**
   * Remove participant
   */
  async removeParticipant(conversationId, userId) {
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { user: userId } } },
      { new: true }
    );
  }

  /**
   * Update participant role
   */
  async updateParticipantRole(conversationId, userId, role) {
    return this.conversationModel.findOneAndUpdate(
      { _id: conversationId, "participants.user": userId },
      { $set: { "participants.$.role": role } },
      { new: true }
    );
  }

  /**
   * Update last message
   */
  async updateLastMessage(conversationId, messageId) {
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: messageId,
        lastMessageAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Search conversations by name (for groups)
   */
  async searchByName(userId, searchTerm) {
    return this.conversationModel
      .find({
        "participants.user": userId,
        type: "group",
        "group.name": { $regex: searchTerm, $options: "i" },
        isDeleted: false,
      })
      .populate("participants.user", "displayName avatar username")
      .sort({ lastMessageAt: -1 })
      .limit(20)
      .exec();
  }
}
