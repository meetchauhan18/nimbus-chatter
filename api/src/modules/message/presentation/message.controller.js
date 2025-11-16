/**
 * Message Controller - HTTP request handlers
 * Thin layer that delegates to MessageService
 */
export function createMessageController(messageService) {
  return {
    /**
     * Send a new message
     * POST /api/messages
     */
    sendMessage: async (req, res) => {
      try {
        const senderId = req.user.id; // From auth middleware
        const { conversationId, content, type, metadata } = req.body;

        const message = await messageService.sendMessage({
          senderId,
          conversationId,
          content,
          type,
          metadata,
        });

        res.status(201).json({
          success: true,
          data: message,
        });
      } catch (error) {
        res.status(error.message.includes("not found") ? 404 : 400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get messages in a conversation
     * GET /api/messages/conversation/:conversationId
     */
    getMessages: async (req, res) => {
      try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const result = await messageService.getMessages(
          conversationId,
          userId,
          { page: parseInt(page), limit: parseInt(limit) }
        );

        res.json({
          success: true,
          data: result.messages,
          pagination: result.pagination,
        });
      } catch (error) {
        const statusCode = error.message.includes("Unauthorized")
          ? 403
          : error.message.includes("not found")
            ? 404
            : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get single message
     * GET /api/messages/:messageId
     */
    getMessageById: async (req, res) => {
      try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await messageService.getById(messageId, userId);

        res.json({
          success: true,
          data: message,
        });
      } catch (error) {
        const statusCode = error.message.includes("Unauthorized")
          ? 403
          : error.message.includes("not found")
            ? 404
            : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Mark message as read
     * PUT /api/messages/:messageId/read
     */
    markAsRead: async (req, res) => {
      try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await messageService.markAsRead(messageId, userId);

        res.json({
          success: true,
          data: message,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Mark all messages in conversation as read
     * PUT /api/messages/conversation/:conversationId/read
     */
    markAllAsRead: async (req, res) => {
      try {
        const userId = req.user.id;
        const { conversationId } = req.params;

        const result = await messageService.markAllAsRead(
          conversationId,
          userId
        );

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
     * Delete a message
     * DELETE /api/messages/:messageId
     */
    deleteMessage: async (req, res) => {
      try {
        const userId = req.user.id;
        const { messageId } = req.params;

        await messageService.deleteMessage(messageId, userId);

        res.json({
          success: true,
          message: "Message deleted successfully",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get unread message count
     * GET /api/messages/unread/count
     */
    getUnreadCount: async (req, res) => {
      try {
        const userId = req.user.id;

        const result = await messageService.getUnreadCount(userId);

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
     * Search messages in conversation
     * GET /api/messages/conversation/:conversationId/search
     */
    searchMessages: async (req, res) => {
      try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: "Search query is required",
          });
        }

        const result = await messageService.searchMessages(
          conversationId,
          userId,
          q
        );

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
  };
}
