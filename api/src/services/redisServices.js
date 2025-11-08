const cacheClient = require("../config/redis.js");


class RedisService {
  // User session management
  async setUserSession(userId, data, ttl = 86400) {
    await cacheClient.setex(`session:${userId}`, ttl, JSON.stringify(data));
  }

  async getUserSession(userId) {
    const data = await cacheClient.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  // Online presence
  async setUserOnline(userId) {
    await cacheClient.zadd("presence:online", Date.now(), userId);
  }

  async setUserOffline(userId) {
    await cacheClient.zrem("presence:online", userId);
  }

  async getOnlineUsers() {
    return await cacheClient.zrange("presence:online", 0, -1);
  }

  // Typing indicators
  async setTyping(conversationId, userId) {
    await cacheClient.sadd(`typing:${conversationId}`, userId);
    await cacheClient.expire(`typing:${conversationId}`, 5);
  }

  async removeTyping(conversationId, userId) {
    await cacheClient.srem(`typing:${conversationId}`, userId);
  }

  async getTypingUsers(conversationId) {
    return await cacheClient.smembers(`typing:${conversationId}`);
  }

  // Unread counts
  async incrementUnread(userId, conversationId) {
    await cacheClient.hincrby(`unread:${userId}`, conversationId, 1);
  }

  async resetUnread(userId, conversationId) {
    await cacheClient.hdel(`unread:${userId}`, conversationId);
  }

  async getUnreadCounts(userId) {
    const counts = await cacheClient.hgetall(`unread:${userId}`);
    return Object.entries(counts).reduce((acc, [key, val]) => {
      acc[key] = parseInt(val);
      return acc;
    }, {});
  }
}

export default new RedisService();