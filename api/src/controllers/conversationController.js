import { asyncHandler } from "../utils/asyncHandler.js";
import { conversationService } from "../services/conversation.service.js";
import { successResponse } from "../utils/response.js";

export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  console.log("🚀 ~ userId:", userId)
  const { limit, offset } = req.query;
  console.log("🚀 ~ offset:", offset)
  console.log("🚀 ~ limit:", limit)

  const conversations = await conversationService?.getUserConversations(userId, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  console.log("🚀 ~ conversations:", conversations)

  successResponse(res, conversations, "Conversations retrieved");
});

export const createConversation = asyncHandler(async (req, res) => {
  const { participantIds, type, name } = req.body;
  const creatorId = req.user.userId;
  console.log("🚀 ~ creatorId:", creatorId)

  const conversation = await conversationService.createConversation({
    creatorId,
    participantIds,
    type: type || "direct",
    name,
  });
  console.log("🚀 ~ conversation:", conversation)

  successResponse(res, conversation, "Conversation created", 201);
});

export const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const conversation = await conversationService.getConversation(id, userId);

  successResponse(res, conversation, "Conversation retrieved");
});

export const updateConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const updates = req.body;

  const conversation = await conversationService.updateConversation(
    id,
    userId,
    updates
  );

  successResponse(res, conversation, "Conversation updated");
});
