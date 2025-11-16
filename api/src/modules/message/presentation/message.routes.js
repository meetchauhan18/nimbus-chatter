import { Router } from 'express';

/**
 * Message Routes
 * Defines HTTP endpoints for message operations
 */
export function createMessageRoutes(messageController, authMiddleware, validate, messageValidator) {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  /**
   * @route   POST /api/messages
   * @desc    Send a new message
   * @access  Private
   */
  router.post(
    '/',
    validate(messageValidator.sendMessage),
    messageController.sendMessage
  );

  /**
   * @route   GET /api/messages/conversation/:conversationId
   * @desc    Get messages in a conversation
   * @access  Private
   */
  router.get(
    '/conversation/:conversationId',
    validate(messageValidator.getMessages),
    messageController.getMessages
  );

  /**
   * @route   GET /api/messages/conversation/:conversationId/search
   * @desc    Search messages in a conversation
   * @access  Private
   */
  router.get(
    '/conversation/:conversationId/search',
    validate(messageValidator.searchMessages),
    messageController.searchMessages
  );

  /**
   * @route   GET /api/messages/unread/count
   * @desc    Get unread message count for current user
   * @access  Private
   */
  router.get(
    '/unread/count',
    messageController.getUnreadCount
  );

  /**
   * @route   GET /api/messages/:messageId
   * @desc    Get single message by ID
   * @access  Private
   */
  router.get(
    '/:messageId',
    validate(messageValidator.getMessageById),
    messageController.getMessageById
  );

  /**
   * @route   PUT /api/messages/:messageId/read
   * @desc    Mark message as read
   * @access  Private
   */
  router.put(
    '/:messageId/read',
    validate(messageValidator.markAsRead),
    messageController.markAsRead
  );

  /**
   * @route   PUT /api/messages/conversation/:conversationId/read
   * @desc    Mark all messages in conversation as read
   * @access  Private
   */
  router.put(
    '/conversation/:conversationId/read',
    validate(messageValidator.markAllAsRead),
    messageController.markAllAsRead
  );

  /**
   * @route   DELETE /api/messages/:messageId
   * @desc    Delete a message
   * @access  Private
   */
  router.delete(
    '/:messageId',
    validate(messageValidator.deleteMessage),
    messageController.deleteMessage
  );

  return router;
}
