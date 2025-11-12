import { asyncHandler } from "../utils/asyncHandler.js";
import { conversationService } from "../services/conversation.service.js";
import { groupService } from "../services/group.service.js";
import { successResponse } from "../utils/response.js";

export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  console.log("🚀 ~ userId:", userId);
  const { limit, offset } = req.query;
  console.log("🚀 ~ offset:", offset);
  console.log("🚀 ~ limit:", limit);

  const conversations = await conversationService?.getUserConversations(
    userId,
    {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    }
  );
  console.log("🚀 ~ conversations:", conversations);

  successResponse(res, conversations, "Conversations retrieved");
});

export const createConversation = asyncHandler(async (req, res) => {
  const { participantIds, type, name } = req.body;
  const creatorId = req.user.userId;
  console.log("🚀 ~ creatorId:", creatorId);

  const conversation = await conversationService.createConversation({
    creatorId,
    participantIds,
    type: type || "direct",
    name,
  });
  console.log("🚀 ~ conversation:", conversation);

  successResponse(res, conversation, "Conversation created", 201);
});

export const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const conversation = await conversationService.getConversation(id, userId);

  successResponse(res, conversation, "Conversation retrieved");
});

export const updateConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  const conversation = await conversationService.updateConversation(
    id,
    userId,
    updates
  );

  successResponse(res, conversation, "Conversation updated");
});

// ========== 👥 PHASE 5: GROUP MANAGEMENT ==========

/**
 * Add participants to group
 */
export const addParticipants = asyncHandler(async (req, res) => {
  const { id } = req.params; // conversationId
  const { userIds } = req.body;
  const adminUserId = req.user.userId;

  console.log("🚀 ~ addParticipants ~ conversationId:", id);
  console.log("🚀 ~ addParticipants ~ adminUserId:", adminUserId);
  console.log("🚀 ~ addParticipants ~ userIds:", userIds);

  const result = await groupService.addParticipants(id, adminUserId, userIds);

  res.json(successResponse(result, "Participants added successfully"));
});

/**
 * Remove participant from group
 */
export const removeParticipant = asyncHandler(async (req, res) => {
  const { id, userId } = req.params; // conversationId, targetUserId
  const adminUserId = req.user.userId;

  console.log("🚀 ~ removeParticipant ~ conversationId:", id);
  console.log("🚀 ~ removeParticipant ~ adminUserId:", adminUserId);
  console.log("🚀 ~ removeParticipant ~ targetUserId:", userId);

  const result = await groupService.removeParticipant(id, adminUserId, userId);

  res.json(successResponse(result, "Participant removed successfully"));
});

/**
 * Leave group
 */
export const leaveGroup = asyncHandler(async (req, res) => {
  const { id } = req.params; // conversationId
  const userId = req.user.userId;

  console.log("🚀 ~ leaveGroup ~ conversationId:", id);
  console.log("🚀 ~ leaveGroup ~ userId:", userId);

  const result = await groupService.leaveGroup(id, userId);

  res.json(successResponse(result, "Left group successfully"));
});

/**
 * Promote user to admin
 */
export const promoteToAdmin = asyncHandler(async (req, res) => {
  const { id, userId } = req.params; // conversationId, targetUserId
  const ownerId = req.user.userId;

  console.log("🚀 ~ promoteToAdmin ~ conversationId:", id);
  console.log("🚀 ~ promoteToAdmin ~ ownerId:", ownerId);
  console.log("🚀 ~ promoteToAdmin ~ targetUserId:", userId);

  const result = await groupService.promoteToAdmin(id, ownerId, userId);

  res.json(successResponse(result, "User promoted to admin"));
});

/**
 * Demote admin to member
 */
export const demoteFromAdmin = asyncHandler(async (req, res) => {
  const { id, userId } = req.params; // conversationId, targetUserId
  const ownerId = req.user.userId;

  console.log("🚀 ~ demoteFromAdmin ~ conversationId:", id);
  console.log("🚀 ~ demoteFromAdmin ~ ownerId:", ownerId);
  console.log("🚀 ~ demoteFromAdmin ~ targetUserId:", userId);

  const result = await groupService.demoteFromAdmin(id, ownerId, userId);

  res.json(successResponse(result, "Admin demoted successfully"));
});

/**
 * Update group info
 */
export const updateGroupInfo = asyncHandler(async (req, res) => {
  const { id } = req.params; // conversationId
  const userId = req.user.userId;
  const updates = req.body; // { name, description, avatar }

  console.log("🚀 ~ updateGroupInfo ~ conversationId:", id);
  console.log("🚀 ~ updateGroupInfo ~ userId:", userId);
  console.log("🚀 ~ updateGroupInfo ~ updates:", updates);

  const result = await groupService.updateGroupInfo(id, userId, updates);

  res.json(successResponse(result, "Group info updated successfully"));
});

/**
 * Transfer ownership
 */
export const transferOwnership = asyncHandler(async (req, res) => {
  const { id } = req.params; // conversationId
  const { newOwnerId } = req.body;
  const currentOwnerId = req.user.userId;

  console.log("🚀 ~ transferOwnership ~ conversationId:", id);
  console.log("🚀 ~ transferOwnership ~ currentOwnerId:", currentOwnerId);
  console.log("🚀 ~ transferOwnership ~ newOwnerId:", newOwnerId);

  const result = await groupService.transferOwnership(
    id,
    currentOwnerId,
    newOwnerId
  );

  res.json(successResponse(result, "Ownership transferred successfully"));
});

/**
 * Get group members
 */
export const getGroupMembers = asyncHandler(async (req, res) => {
  const { id } = req.params; // conversationId
  const userId = req.user.userId;

  console.log("🚀 ~ getGroupMembers ~ conversationId:", id);
  console.log("🚀 ~ getGroupMembers ~ userId:", userId);

  const result = await groupService.getGroupMembers(id, userId);

  res.json(successResponse(result, "Group members retrieved successfully"));
});
