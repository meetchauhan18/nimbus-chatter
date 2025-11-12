import { asyncHandler } from "../utils/asyncHandler.js";
import { messageService } from "../services/message.service.js";
import { successResponse } from "../utils/response.js";

/**
 * Get messages for a conversation
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;
  const { before, limit } = req.query;

  console.log("🚀 ~ getMessages ~ conversationId:", conversationId);
  console.log("🚀 ~ getMessages ~ userId:", userId);

  const result = await messageService.getMessages(conversationId, userId, {
    before,
    limit: parseInt(limit) || 50,
  });

  res.json(successResponse(result, "Messages retrieved successfully"));
});

/**
 * Get messages with pagination (optimized)
 */
export const getMessagesPaginated = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;
  const { before, after, limit, includeDeleted } = req.query;

  const result = await messageService.getMessagesPaginated(
    conversationId,
    userId,
    {
      before,
      after,
      limit: parseInt(limit) || 50,
      includeDeleted: includeDeleted === "true",
    }
  );

  res.json(successResponse(result, "Messages retrieved successfully"));
});

/**
 * Get single message by ID
 */
export const getMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  const message = await messageService.getMessageById(messageId, userId);

  res.json(successResponse(message, "Message retrieved successfully"));
});

/**
 * Edit message
 */
export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ editMessage ~ messageId:", messageId);
  console.log("🚀 ~ editMessage ~ content:", content);

  const message = await messageService.editMessage(messageId, userId, content);

  res.json(successResponse(message, "Message edited successfully"));
});

/**
 * Delete message for current user only
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  console.log("🚀 ~ deleteMessage ~ messageId:", messageId);

  const message = await messageService.deleteMessage(messageId, userId);

  res.json(successResponse(message, "Message deleted successfully"));
});

/**
 * Delete message for everyone (sender only, within 1 hour)
 */
export const deleteMessageForEveryone = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  console.log("🚀 ~ deleteMessageForEveryone ~ messageId:", messageId);

  const message = await messageService.deleteMessageForEveryone(
    messageId,
    userId
  );

  res.json(
    successResponse(message, "Message deleted for everyone successfully")
  );
});

/**
 * Add reaction to message
 */
export const addReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ addReaction ~ messageId:", messageId);
  console.log("🚀 ~ addReaction ~ emoji:", emoji);

  const message = await messageService.addReaction(messageId, userId, emoji);

  res.json(successResponse(message, "Reaction added successfully"));
});

/**
 * Remove reaction from message
 */
export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ removeReaction ~ messageId:", messageId);
  console.log("🚀 ~ removeReaction ~ emoji:", emoji);

  const message = await messageService.removeReaction(messageId, userId, emoji);

  res.json(successResponse(message, "Reaction removed successfully"));
});

/**
 * Mark message as delivered
 */
export const markAsDelivered = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  const message = await messageService.markAsDelivered(messageId, userId);

  res.json(successResponse(message, "Message marked as delivered"));
});

/**
 * Mark message as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  console.log("🚀 ~ markAsRead ~ messageId:", messageId);

  const message = await messageService.markAsRead(messageId, userId);

  res.json(successResponse(message, "Message marked as read"));
});

/**
 * Mark all conversation messages as read
 */
export const markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  console.log("🚀 ~ markConversationAsRead ~ conversationId:", conversationId);

  const result = await messageService.markConversationAsRead(
    conversationId,
    userId
  );

  res.json(successResponse(result, "Conversation messages marked as read"));
});

/**
 * Get read receipts for a message
 */
export const getReadReceipts = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  
  const message = await Message.findById(messageId)
    .populate("seenBy.userId", "username displayName avatar")
    .populate("deliveredTo.userId", "username displayName avatar")
    .select("deliveredTo seenBy status");

  if (!message) {
    throw new NotFoundError("Message not found");
  }

  res.json(successResponse({
    messageId: message._id,
    deliveredTo: message.deliveredTo,
    seenBy: message.seenBy,
    status: message.status,
  }, "Read receipts retrieved"));
});

/**
 * Get total unread count
 */
export const getTotalUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  // Use your existing RedisService
  const counts = await RedisService.getUnreadCounts(userId);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  res.json(successResponse({ total, byConversation: counts }, "Unread count retrieved"));
});

