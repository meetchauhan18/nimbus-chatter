import Conversation from "../models/Conversation.js";
import { NotFoundError, BadRequestError } from "../utils/AppError.js";

export class ConversationService {
  /**
   * Get user's conversations with pagination
   */
  async getUserConversations(userId, options = {}) {
    console.log("🚀 ~ ConversationService ~ getUserConversations ~ userId:", userId)
    const { limit = 50, offset = 0 } = options;

    const conversations = await Conversation.find({
      "participants.user": userId,
    })
      .populate("participants.user", "displayName avatar phone")
      .populate({
        path: "lastMessage",
        select: "content senderId createdAt type",
        populate: {
          path: "senderId",
          select: "displayName avatar",
        },
      })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);
    console.log("🚀 ~ ConversationService ~ getUserConversations ~ conversations:", conversations)

    return conversations;
  }

  /**
   * Create new conversation (direct or group)
   */
  async createConversation({
    creatorId,
    participantIds,
    type = "direct",
    name,
  }) {
    // Validation
    if (type === "direct" && participantIds.length !== 1) {
      throw new BadRequestError(
        "Direct conversations require exactly 1 other participant"
      );
    }

    if (type === "group" && !name) {
      throw new BadRequestError("Group conversations require a name");
    }

    // Check if direct conversation already exists
    if (type === "direct") {
      const existing = await Conversation.findOne({
        type: "direct",
        "participants.user": { $all: [creatorId, participantIds[0]] },
      });

      if (existing) {
        // Populate and return existing conversation
        await existing.populate(
          "participants.user",
          "displayName avatar phone"
        );
        return existing;
      }
    }

    // Create participants array
    const participants = [
      {
        user: creatorId,
        role: type === "group" ? "admin" : "member",
        joinedAt: new Date(),
      },
      ...participantIds.map((id) => ({
        user: id,
        role: "member",
        joinedAt: new Date(),
      })),
    ];

    // Create conversation
    const conversation = await Conversation.create({
      type,
      name: type === "group" ? name : null,
      participants,
    });

    // Populate before returning
    await conversation.populate(
      "participants.user",
      "displayName avatar phone"
    );

    return conversation;
  }

  /**
   * Get single conversation with full details
   */
  async getConversation(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId)
      .populate("participants.user", "displayName avatar phone status")
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "displayName avatar",
        },
      });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      (p) => p.user._id.toString() === userId
    );

    if (!isParticipant) {
      throw new BadRequestError(
        "You are not a participant in this conversation"
      );
    }

    return conversation;
  }

  /**
   * Update conversation settings
   */
  async updateConversation(conversationId, userId, updates) {
    const conversation = await this.getConversation(conversationId, userId);

    // Only admins can update group conversations
    if (conversation.type === "group") {
      const participant = conversation.participants.find(
        (p) => p.user._id.toString() === userId
      );

      if (participant.role !== "admin") {
        throw new BadRequestError("Only admins can update group settings");
      }
    }

    // Allowed updates
    const allowedUpdates = ["name", "isArchived"];
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        conversation[key] = updates[key];
      }
    });

    await conversation.save();
    return conversation;
  }
}

export const conversationService = new ConversationService();
