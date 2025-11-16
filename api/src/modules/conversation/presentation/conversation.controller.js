/**
 * Conversation Controller
 * HTTP request handlers for conversation operations
 * Combines both conversation and group functionality
 */
export function createConversationController(
  conversationService,
  groupService
) {
  return {
    // ===== CONVERSATION OPERATIONS =====

    /**
     * Get user's conversations
     * GET /api/conversations
     */
    getConversations: async (req, res) => {
      try {
        const userId = req.user.id;
        const { limit, offset } = req.query;

        const conversations = await conversationService.getUserConversations(
          userId,
          {
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
          }
        );

        res.json({
          success: true,
          data: conversations,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Create new conversation
     * POST /api/conversations
     */
    createConversation: async (req, res) => {
      try {
        const creatorId = req.user.id;
        const { participantIds, type, name } = req.body;

        const conversation = await conversationService.createConversation({
          creatorId,
          participantIds,
          type: type || "direct",
          name,
        });

        res.status(201).json({
          success: true,
          data: conversation,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get single conversation
     * GET /api/conversations/:id
     */
    getConversation: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        const conversation = await conversationService.getById(id, userId);

        res.json({
          success: true,
          data: conversation,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Update conversation
     * PUT /api/conversations/:id
     */
    updateConversation: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        const updates = req.body;

        const conversation = await conversationService.updateConversation(
          id,
          userId,
          updates
        );

        res.json({
          success: true,
          data: conversation,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Delete conversation
     * DELETE /api/conversations/:id
     */
    deleteConversation: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        await conversationService.deleteConversation(id, userId);

        res.json({
          success: true,
          message: "Conversation deleted successfully",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Search conversations
     * GET /api/conversations/search
     */
    searchConversations: async (req, res) => {
      try {
        const userId = req.user.id;
        const { q } = req.query;

        const result = await conversationService.searchConversations(userId, q);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    // ===== GROUP OPERATIONS =====

    /**
     * Add participants to group
     * POST /api/conversations/:id/participants
     */
    addParticipants: async (req, res) => {
      try {
        const { id } = req.params;
        const { userIds } = req.body;
        const adminUserId = req.user.id;

        const result = await groupService.addParticipants(
          id,
          adminUserId,
          userIds
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found")
          ? 404
          : error.message.includes("Only admins")
            ? 403
            : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Remove participant from group
     * DELETE /api/conversations/:id/participants/:userId
     */
    removeParticipant: async (req, res) => {
      try {
        const { id, userId } = req.params;
        const adminUserId = req.user.id;

        const result = await groupService.removeParticipant(
          id,
          adminUserId,
          userId
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found")
          ? 404
          : error.message.includes("Only admins")
            ? 403
            : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Leave group
     * POST /api/conversations/:id/leave
     */
    leaveGroup: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await groupService.leaveGroup(id, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Promote user to admin
     * POST /api/conversations/:id/admins/:userId
     */
    promoteToAdmin: async (req, res) => {
      try {
        const { id, userId } = req.params;
        const ownerId = req.user.id;

        const result = await groupService.promoteToAdmin(id, ownerId, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("Only the owner") ? 403 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Demote admin to member
     * DELETE /api/conversations/:id/admins/:userId
     */
    demoteFromAdmin: async (req, res) => {
      try {
        const { id, userId } = req.params;
        const ownerId = req.user.id;

        const result = await groupService.demoteFromAdmin(id, ownerId, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("Only the owner") ? 403 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Update group info
     * PATCH /api/conversations/:id/info
     */
    updateGroupInfo: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        const updates = req.body;

        const result = await groupService.updateGroupInfo(id, userId, updates);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("Only admins") ? 403 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Transfer ownership
     * POST /api/conversations/:id/transfer-ownership
     */
    transferOwnership: async (req, res) => {
      try {
        const { id } = req.params;
        const { newOwnerId } = req.body;
        const currentOwnerId = req.user.id;

        const result = await groupService.transferOwnership(
          id,
          currentOwnerId,
          newOwnerId
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("Only the owner") ? 403 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get group members
     * GET /api/conversations/:id/members
     */
    getGroupMembers: async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await groupService.getGroupMembers(id, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found")
          ? 404
          : error.message.includes("not a member")
            ? 403
            : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },
  };
}
