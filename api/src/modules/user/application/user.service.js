/**
 * User Service
 * Business logic for user operations (search, block/unblock)
 */
export class UserService {
  constructor({ userRepository, cache, eventBus, logger }) {
    this.userRepository = userRepository;
    this.cache = cache;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  /**
   * Search users by query
   */
  async searchUsers(query, currentUserId, options = {}) {
    const { limit = 20 } = options;

    // Validate query
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Try cache first
    const cacheKey = `user:search:${currentUserId}:${query}:${limit}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      this.logger.debug("Cache hit for user search", { query });
      return JSON.parse(cached);
    }

    // Search database
    const users = await this.userRepository.searchUsers(
      query,
      currentUserId,
      limit
    );

    // Cache for 2 minutes
    await this.cache.setex(cacheKey, 120, JSON.stringify(users));

    this.logger.info("User search completed", {
      query,
      resultsCount: users.length,
    });

    return users;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    this.logger.debug("User profile retrieved", { userId });
    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Block a user
   */
  async blockUser(blockerId, blockedUserId) {
    // Validate: can't block yourself
    if (blockerId === blockedUserId) {
      throw new Error("You cannot block yourself");
    }

    // Check if both users exist
    const blocker = await this.userRepository.findById(blockerId);
    const blockedUser = await this.userRepository.findById(blockedUserId);

    if (!blocker || !blockedUser) {
      throw new Error("User not found");
    }

    // Block the user
    await this.userRepository.blockUser(blockerId, blockedUserId);

    // Emit event
    this.eventBus.emit("user.blocked", {
      blockerId: blockerId.toString(),
      blockedUserId: blockedUserId.toString(),
    });

    this.logger.info("User blocked", {
      blockerId,
      blockedUserId,
    });

    return {
      message: "User blocked successfully",
      blockedUser: {
        _id: blockedUser._id,
        username: blockedUser.username,
        displayName: blockedUser.displayName,
      },
    };
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId, blockedUserId) {
    const blocker = await this.userRepository.findById(blockerId);

    if (!blocker) {
      throw new Error("User not found");
    }

    // Check if user is actually blocked
    const isBlocked = await this.userRepository.isUserBlocked(
      blockerId,
      blockedUserId
    );

    if (!isBlocked) {
      throw new Error("User is not blocked");
    }

    // Unblock the user
    await this.userRepository.unblockUser(blockerId, blockedUserId);

    // Emit event
    this.eventBus.emit("user.unblocked", {
      blockerId: blockerId.toString(),
      unblockedUserId: blockedUserId.toString(),
    });

    this.logger.info("User unblocked", {
      blockerId,
      unblockedUserId: blockedUserId,
    });

    return {
      message: "User unblocked successfully",
    };
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(userId) {
    const result = await this.userRepository.getBlockedUsers(userId);

    if (!result) {
      throw new Error("User not found");
    }

    this.logger.debug("Blocked users list retrieved", {
      userId,
      count: result.blockedUsers.length,
    });

    return result.blockedUsers;
  }

  /**
   * Check block status between two users
   */
  async isBlocked(userIdA, userIdB) {
    const result = await this.userRepository.checkBlockStatus(userIdA, userIdB);

    this.logger.debug("Block status checked", {
      userIdA,
      userIdB,
      isBlocked: result.isBlocked,
    });

    return result;
  }
}
