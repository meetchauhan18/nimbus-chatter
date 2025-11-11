import Conversation from "../models/Conversation.js";
import { NotFoundError, BadRequestError } from "../utils/AppError.js";

export class ConversationService {
  /**
   * Get user's conversations with pagination
   */
  async getUserConversations(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const conversations = await Conversation.find({
      "participants.user": userId,
    })
      .populate("participants.user", "displayName avatar email username") // FIXED: Removed phone, added email and username
      .populate({
        path: "lastMessage",
        select: "content senderId createdAt type",
        populate: {
          path: "senderId",
          select: "displayName avatar username", // FIXED: Added username
        },
      })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);

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
    // Validate direct conversation has exactly 2 participants
    if (type === "direct" && participantIds.length !== 2) {
      throw new BadRequestError(
        "Direct conversation must have exactly 2 participants"
      );
    }

    // Check if direct conversation already exists
    if (type === "direct") {
      const existingConversation = await Conversation.findOne({
        type: "direct",
        "participants.user": { $all: participantIds },
      });

      if (existingConversation) {
        return existingConversation;
      }
    }

    // Create conversation
    const conversation = await Conversation.create({
      type,
      name: type === "group" ? name : undefined,
      participants: participantIds.map((userId) => ({
        user: userId,
        role: userId === creatorId ? "admin" : "member",
      })),
      createdBy: creatorId,
    });

    // Populate user details - FIXED
    await conversation.populate(
      "participants.user",
      "displayName avatar email username"
    );

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId, userId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.user": userId,
    })
      .populate("participants.user", "displayName avatar email username status") // FIXED
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "displayName avatar username", // FIXED
        },
      });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    return conversation;
  }

  /**
   * Add participants to group conversation
   */
  async addParticipants(conversationId, userId, participantIds) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
    });

    if (!conversation) {
      throw new NotFoundError("Group conversation not found");
    }

    // Check if user is admin
    const userParticipant = conversation.participants.find(
      (p) => p.user.toString() === userId.toString()
    );

    if (!userParticipant || userParticipant.role !== "admin") {
      throw new BadRequestError("Only admins can add participants");
    }

    // Add new participants
    const newParticipants = participantIds.map((id) => ({
      user: id,
      role: "member",
    }));

    conversation.participants.push(...newParticipants);
    await conversation.save();

    // FIXED: Populate with correct fields
    await conversation.populate(
      "participants.user",
      "displayName avatar email username"
    );

    return conversation;
  }

  /**
   * Remove participant from group
   */
  async removeParticipant(conversationId, userId, targetUserId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
    });

    if (!conversation) {
      throw new NotFoundError("Group conversation not found");
    }

    // Check if user is admin
    const userParticipant = conversation.participants.find(
      (p) => p.user.toString() === userId.toString()
    );

    if (!userParticipant || userParticipant.role !== "admin") {
      throw new BadRequestError("Only admins can remove participants");
    }

    // Remove participant
    conversation.participants = conversation.participants.filter(
      (p) => p.user.toString() !== targetUserId.toString()
    );

    await conversation.save();

    return conversation;
  }
}

export const conversationService = new ConversationService();
