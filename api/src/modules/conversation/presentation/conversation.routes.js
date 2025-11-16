import { Router } from "express";

/**
 * Conversation Routes
 * Defines HTTP endpoints for conversation and group operations
 */
export function createConversationRoutes(
  conversationController,
  authMiddleware,
  validate,
  conversationValidator
) {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  // ===== CONVERSATION ROUTES =====

  /**
   * @route   GET /api/conversations
   * @desc    Get user's conversations
   * @access  Private
   */
  router.get(
    "/",
    validate(conversationValidator.getConversations),
    conversationController.getConversations
  );

  /**
   * @route   GET /api/conversations/search
   * @desc    Search conversations
   * @access  Private
   */
  router.get(
    "/search",
    validate(conversationValidator.searchConversations),
    conversationController.searchConversations
  );

  /**
   * @route   POST /api/conversations
   * @desc    Create new conversation
   * @access  Private
   */
  router.post(
    "/",
    validate(conversationValidator.createConversation),
    conversationController.createConversation
  );

  /**
   * @route   GET /api/conversations/:id
   * @desc    Get single conversation
   * @access  Private
   */
  router.get(
    "/:id",
    validate(conversationValidator.getConversation),
    conversationController.getConversation
  );

  /**
   * @route   PUT /api/conversations/:id
   * @desc    Update conversation
   * @access  Private
   */
  router.put(
    "/:id",
    validate(conversationValidator.updateConversation),
    conversationController.updateConversation
  );

  /**
   * @route   DELETE /api/conversations/:id
   * @desc    Delete conversation
   * @access  Private
   */
  router.delete(
    "/:id",
    validate(conversationValidator.deleteConversation),
    conversationController.deleteConversation
  );

  // ===== GROUP MANAGEMENT ROUTES =====

  /**
   * @route   GET /api/conversations/:id/members
   * @desc    Get group members
   * @access  Private
   */
  router.get(
    "/:id/members",
    validate(conversationValidator.getGroupMembers),
    conversationController.getGroupMembers
  );

  /**
   * @route   POST /api/conversations/:id/participants
   * @desc    Add participants to group
   * @access  Private (Admin only)
   */
  router.post(
    "/:id/participants",
    validate(conversationValidator.addParticipants),
    conversationController.addParticipants
  );

  /**
   * @route   DELETE /api/conversations/:id/participants/:userId
   * @desc    Remove participant from group
   * @access  Private (Admin only)
   */
  router.delete(
    "/:id/participants/:userId",
    validate(conversationValidator.removeParticipant),
    conversationController.removeParticipant
  );

  /**
   * @route   POST /api/conversations/:id/leave
   * @desc    Leave group
   * @access  Private
   */
  router.post(
    "/:id/leave",
    validate(conversationValidator.leaveGroup),
    conversationController.leaveGroup
  );

  /**
   * @route   POST /api/conversations/:id/admins/:userId
   * @desc    Promote user to admin
   * @access  Private (Owner only)
   */
  router.post(
    "/:id/admins/:userId",
    validate(conversationValidator.promoteToAdmin),
    conversationController.promoteToAdmin
  );

  /**
   * @route   DELETE /api/conversations/:id/admins/:userId
   * @desc    Demote admin to member
   * @access  Private (Owner only)
   */
  router.delete(
    "/:id/admins/:userId",
    validate(conversationValidator.demoteFromAdmin),
    conversationController.demoteFromAdmin
  );

  /**
   * @route   PATCH /api/conversations/:id/info
   * @desc    Update group info (name, description, avatar)
   * @access  Private (Admin only)
   */
  router.patch(
    "/:id/info",
    validate(conversationValidator.updateGroupInfo),
    conversationController.updateGroupInfo
  );

  /**
   * @route   POST /api/conversations/:id/transfer-ownership
   * @desc    Transfer group ownership
   * @access  Private (Owner only)
   */
  router.post(
    "/:id/transfer-ownership",
    validate(conversationValidator.transferOwnership),
    conversationController.transferOwnership
  );

  return router;
}
