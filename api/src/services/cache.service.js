/**
 * Cache Service
 * Provides caching utilities with TTL and invalidation
 * NOW ACCEPTS Redis client via dependency injection
 */
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;

    // TTL configurations (in seconds)
    this.TTL = {
      USER_PROFILE: 60 * 60, // 1 hour
      USER_PRESENCE: 60 * 5, // 5 minutes
      CONVERSATION_PARTICIPANTS: 60 * 30, // 30 minutes
      CONVERSATION_METADATA: 60 * 15, // 15 minutes
      MESSAGE_COUNT: 60 * 10, // 10 minutes
      TYPING_STATUS: 5, // 5 seconds
      RATE_LIMIT: 60 * 15, // 15 minutes
    };
  }

  async cacheUser(userId, userData) {
    const key = `user:${userId}`;
    try {
      await this.redis.setex(
        key,
        this.TTL.USER_PROFILE,
        JSON.stringify(userData)
      );
      return true;
    } catch (error) {
      console.error("Cache user error:", error);
      return false;
    }
  }

  async getUser(userId) {
    const key = `user:${userId}`;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Get cached user error:", error);
      return null;
    }
  }

  async invalidateUser(userId) {
    const key = `user:${userId}`;
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error("Invalidate user error:", error);
      return false;
    }
  }

  async cacheConversationParticipants(conversationId, participants) {
    const key = `conv:participants:${conversationId}`;
    try {
      await this.redis.setex(
        key,
        this.TTL.CONVERSATION_PARTICIPANTS,
        JSON.stringify(participants)
      );
      return true;
    } catch (error) {
      console.error("Cache participants error:", error);
      return false;
    }
  }

  async getConversationParticipants(conversationId) {
    const key = `conv:participants:${conversationId}`;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Get cached participants error:", error);
      return null;
    }
  }

  async cacheConversation(conversationId, conversationData) {
    const key = `conv:${conversationId}`;
    try {
      await this.redis.setex(
        key,
        this.TTL.CONVERSATION_METADATA,
        JSON.stringify(conversationData)
      );
      return true;
    } catch (error) {
      console.error("Cache conversation error:", error);
      return false;
    }
  }

  async getConversation(conversationId) {
    const key = `conv:${conversationId}`;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Get cached conversation error:", error);
      return null;
    }
  }

  async invalidateConversation(conversationId) {
    const keys = [
      `conv:${conversationId}`,
      `conv:participants:${conversationId}`,
    ];
    try {
      await this.redis.del(...keys);
      return true;
    } catch (error) {
      console.error("Invalidate conversation error:", error);
      return false;
    }
  }

  async setPresence(userId, status, lastSeen = null) {
    const key = `presence:${userId}`;
    const data = {
      status,
      lastSeen: lastSeen || Date.now(),
      timestamp: Date.now(),
    };
    try {
      await this.redis.setex(key, this.TTL.USER_PRESENCE, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Set presence error:", error);
      return false;
    }
  }

  async getPresence(userId) {
    const key = `presence:${userId}`;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Get presence error:", error);
      return null;
    }
  }

  async getMultiplePresence(userIds) {
    const pipeline = this.redis.pipeline();
    userIds.forEach((userId) => pipeline.get(`presence:${userId}`));

    try {
      const results = await pipeline.exec();
      return results.map(([err, data], index) => ({
        userId: userIds[index],
        presence: data ? JSON.parse(data) : null,
      }));
    } catch (error) {
      console.error("Get multiple presence error:", error);
      return [];
    }
  }

  async clearPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error("Clear pattern error:", error);
      return 0;
    }
  }

  async getStats() {
    try {
      const info = await this.redis.info("stats");
      const keyspace = await this.redis.info("keyspace");
      return {
        info,
        keyspace,
        connected: this.redis.status === "ready",
      };
    } catch (error) {
      console.error("Get cache stats error:", error);
      return null;
    }
  }
}

// Export class, NOT instance - will be instantiated with redis client
export default CacheService;
