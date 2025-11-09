import { cacheClient } from '../../config/redis.js';

/**
 * MessageQueue - Handles offline message delivery
 * Queues messages for offline users and delivers on reconnection
 */
export class MessageQueue {
  constructor() {
    this.redis = cacheClient;
  }

  /**
   * Queue a message for offline user
   */
  async enqueue(userId, message) {
    try {
      const queueKey = `queue:${userId}`;
      await this.redis.lpush(queueKey, JSON.stringify(message));
      
      // Set expiry (7 days)
      await this.redis.expire(queueKey, 7 * 24 * 60 * 60);
      
      console.log(`📬 Queued message for offline user: ${userId}`);
      return true;
    } catch (error) {
      console.error('MessageQueue enqueue error:', error);
      return false;
    }
  }

  /**
   * Flush all queued messages for a user
   */
  async flush(userId) {
    try {
      const queueKey = `queue:${userId}`;
      const messages = await this.redis.lrange(queueKey, 0, -1);
      
      if (messages.length > 0) {
        await this.redis.del(queueKey);
        console.log(`📨 Flushed ${messages.length} queued messages for user: ${userId}`);
        return messages.map(msg => JSON.parse(msg));
      }
      
      return [];
    } catch (error) {
      console.error('MessageQueue flush error:', error);
      return [];
    }
  }

  /**
   * Get queue length for a user
   */
  async getQueueLength(userId) {
    try {
      const queueKey = `queue:${userId}`;
      return await this.redis.llen(queueKey);
    } catch (error) {
      console.error('MessageQueue getQueueLength error:', error);
      return 0;
    }
  }

  /**
   * Clear queue for a user
   */
  async clear(userId) {
    try {
      const queueKey = `queue:${userId}`;
      await this.redis.del(queueKey);
      console.log(`🗑️ Cleared message queue for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('MessageQueue clear error:', error);
      return false;
    }
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();
