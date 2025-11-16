/**
 * Conversation Service
 * Business logic for basic conversation operations
 */
export class ConversationService {
  constructor({ conversationRepository, cache, eventBus, logger }) {
    this.conversationRepository = conversationRepository;
    this.cache = cache;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    // Try cache first
    const cacheKey = `conversations:user:${userId}:${offset}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug("Cache hit for user conversations", { userId });
      return JSON.parse(cached);
    }

    // Fetch from database
    const conversations = await this.conversationRepository.findByUser(userId, {
      limit,
      offset,
    });

    // Cache for 2 minutes
    await this.cache.setex(cacheKey, 120, JSON.stringify(conversations));

    return conversations;
  }

  /**
   * Create new conversation
   */
  async createConversation({
    creatorId,
    participantIds,
    type = "direct",
    name,
  }) {
    // Validate direct conversation
    if (type === "direct" && participantIds.length !== 2) {
      throw new Error("Direct conversation must have exactly 2 participants");
    }

    // Check if direct conversation already exists
    if (type === "direct") {
      const existing =
        await this.conversationRepository.findDirectConversation(
          participantIds
        );

      if (existing) {
        this.logger.info("Direct conversation already exists", {
          conversationId: existing._id,
        });
        return existing;
      }
    }

    // Create conversation
    const conversationData = {
      type,
      participants: participantIds.map((userId) => ({
        user: userId,
        role:
          userId === creatorId
            ? type === "group"
              ? "owner"
              : "member"
            : "member",
      })),
      createdBy: creatorId,
    };

    // For group conversations, set group metadata
    if (type === "group") {
      conversationData.group = {
        name: name || "Unnamed Group",
        createdBy: creatorId,
      };
      conversationData.admins = [creatorId]; // Creator is admin
    }

    const conversation =
      await this.conversationRepository.create(conversationData);

    // Invalidate cache for all participants
    await this._invalidateUserCaches(participantIds);

    // Emit event
    this.eventBus.emit("conversation.created", {
      conversationId: conversation._id.toString(),
      type,
      creatorId: creatorId.toString(),
      participantIds: participantIds.map((id) => id.toString()),
    });

    this.logger.info("Conversation created", {
      conversationId: conversation._id,
      type,
    });

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getById(conversationId, userId = null) {
    const conversation = await this.conversationRepository.findById(
      conversationId,
      userId
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }

  /**
   * Update conversation
   */
  async updateConversation(conversationId, userId, updates) {
    const conversation = await this.getById(conversationId, userId);

    // Verify user has permission to update
    if (
      conversation.type === "group" &&
      !conversation.hasAdminPrivileges(userId)
    ) {
      throw new Error("Only admins can update group conversations");
    }

    const updated = await this.conversationRepository.update(
      conversationId,
      updates
    );

    // Invalidate cache
    await this._invalidateConversationCache(conversationId);

    this.eventBus.emit("conversation.updated", {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
      updates,
    });

    return updated;
  }

  /**
   * Update last message (called by message service)
   */
  async updateLastMessage(conversationId, messageId) {
    await this.conversationRepository.updateLastMessage(
      conversationId,
      messageId
    );
    await this._invalidateConversationCache(conversationId);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId, userId) {
    const conversation = await this.getById(conversationId, userId);

    // Only owner can delete group conversations
    if (conversation.type === "group" && !conversation.isOwner(userId)) {
      throw new Error("Only the owner can delete this group");
    }

    await this.conversationRepository.softDelete(conversationId);

    // Invalidate cache
    await this._invalidateConversationCache(conversationId);

    this.eventBus.emit("conversation.deleted", {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
    });

    return { success: true };
  }

  /**
   * Search conversations
   */
  async searchConversations(userId, searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new Error("Search term is required");
    }

    const conversations = await this.conversationRepository.searchByName(
      userId,
      searchTerm
    );

    return { conversations, count: conversations.length };
  }

  // ===== Private Helper Methods =====

  async _invalidateUserCaches(userIds) {
    for (const userId of userIds) {
      const pattern = `conversations:user:${userId}:*`;
      await this.cache.del(pattern);
    }
  }

  async _invalidateConversationCache(conversationId) {
    await this.cache.del(`conversation:${conversationId}`);
  }
}
