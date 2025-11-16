/**
 * Message Service - Business logic for message operations
 * Depends on MessageRepository, ConversationService, Cache, EventBus
 */
export class MessageService {
  constructor({
    messageRepository,
    conversationService,
    cache,
    eventBus,
    logger,
    deliveryQueue,
  }) {
    this.messageRepository = messageRepository;
    this.conversationService = conversationService;
    this.cache = cache;
    this.eventBus = eventBus;
    this.logger = logger;
    this.deliveryQueue = deliveryQueue;
  }

  /**
   * Send a message
   */
  async sendMessage({
    senderId,
    conversationId,
    content,
    type = "text",
    metadata = {},
  }) {
    // 1. Verify conversation exists and user is participant
    const conversation = await this.conversationService.getById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === senderId.toString()
    );

    if (!isParticipant) {
      throw new Error("User is not a participant in this conversation");
    }

    // 2. Create message
    const messageData = {
      conversation: conversationId,
      sender: senderId,
      content: { text: content },
      type,
      status: "sent",
      metadata,
      timestamps: {
        sentAt: new Date(),
      },
    };

    const message = await this.messageRepository.create(messageData);

    // 3. Update conversation's last message
    await this.conversationService.updateLastMessage(
      conversationId,
      message._id
    );

    // 4. Invalidate cache
    await this.cache.del(`messages:conversation:${conversationId}`);

    // 5. Queue message for delivery (Socket.IO broadcast)
    await this.deliveryQueue.add("send-message", {
      messageId: message._id.toString(),
      conversationId: conversationId.toString(),
      recipientIds: conversation.participants
        .filter((p) => p.toString() !== senderId.toString())
        .map((p) => p.toString()),
    });

    // 6. Emit event for other modules (analytics, notifications)
    this.eventBus.emit("message.sent", {
      messageId: message._id.toString(),
      senderId: senderId.toString(),
      conversationId: conversationId.toString(),
      type,
    });

    this.logger.info("Message sent", {
      messageId: message._id,
      conversationId,
    });

    // 7. Return populated message
    return this.messageRepository.findById(message._id, { sender: true });
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId, userId, { page = 1, limit = 50 } = {}) {
    // 1. Verify user is participant
    const conversation = await this.conversationService.getById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new Error("Unauthorized access to conversation");
    }

    // 2. Try cache first (for page 1)
    if (page === 1) {
      const cached = await this.cache.get(
        `messages:conversation:${conversationId}`
      );
      if (cached) {
        this.logger.debug("Cache hit for messages", { conversationId });
        return JSON.parse(cached);
      }
    }

    // 3. Fetch from database
    const result = await this.messageRepository.findByConversation(
      conversationId,
      { page, limit }
    );

    // 4. Cache first page
    if (page === 1) {
      await this.cache.setex(
        `messages:conversation:${conversationId}`,
        300, // 5 minutes
        JSON.stringify(result)
      );
    }

    return result;
  }

  /**
   * Get single message by ID
   */
  async getById(messageId, userId) {
    const message = await this.messageRepository.findById(messageId, {
      sender: true,
    });

    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user has access
    const conversation = await this.conversationService.getById(
      message.conversation
    );
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new Error("Unauthorized access to message");
    }

    return message;
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId, userId) {
    const message = await this.messageRepository.markAsRead(messageId, userId);

    // Invalidate conversation cache
    await this.cache.del(`messages:conversation:${message.conversation}`);

    // Emit event
    this.eventBus.emit("message.read", {
      messageId: message._id.toString(),
      userId: userId.toString(),
      conversationId: message.conversation.toString(),
    });

    return message;
  }

  /**
   * Mark all messages in conversation as read
   */
  async markAllAsRead(conversationId, userId) {
    const result = await this.messageRepository.markMultipleAsRead(
      conversationId,
      userId
    );

    // Invalidate cache
    await this.cache.del(`messages:conversation:${conversationId}`);

    this.eventBus.emit("messages.read", {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
      count: result.modifiedCount,
    });

    return { updated: result.modifiedCount };
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId, userId) {
    const message = await this.messageRepository.softDelete(messageId, userId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Invalidate cache
    await this.cache.del(`messages:conversation:${message.conversation}`);

    this.eventBus.emit("message.deleted", {
      messageId: message._id.toString(),
      userId: userId.toString(),
    });

    return { success: true };
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId) {
    const count = await this.messageRepository.getUnreadCount(userId);
    return { count };
  }

  /**
   * Search messages
   */
  async searchMessages(conversationId, userId, searchTerm) {
    // Verify user has access
    const conversation = await this.conversationService.getById(conversationId);
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new Error("Unauthorized access to conversation");
    }

    const messages = await this.messageRepository.searchInConversation(
      conversationId,
      searchTerm
    );

    return { messages, count: messages.length };
  }
}
