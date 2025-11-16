class RedisService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async setUserSession(userId, data, ttl = 86400) {
    await this.redis.setex(`session:${userId}`, ttl, JSON.stringify(data));
  }

  async getUserSession(userId) {
    const data = await this.redis.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async setUserOnline(userId) {
    await this.redis.zadd("presence:online", Date.now(), userId);
  }

  async setUserOffline(userId) {
    await this.redis.zrem("presence:online", userId);
  }

  async getOnlineUsers() {
    return await this.redis.zrange("presence:online", 0, -1);
  }

  async setTyping(conversationId, userId) {
    await this.redis.sadd(`typing:${conversationId}`, userId);
    await this.redis.expire(`typing:${conversationId}`, 5);
  }

  async removeTyping(conversationId, userId) {
    await this.redis.srem(`typing:${conversationId}`, userId);
  }

  async getTypingUsers(conversationId) {
    return await this.redis.smembers(`typing:${conversationId}`);
  }

  async incrementUnread(userId, conversationId) {
    await this.redis.hincrby(`unread:${userId}`, conversationId, 1);
  }

  async resetUnread(userId, conversationId) {
    await this.redis.hdel(`unread:${userId}`, conversationId);
  }

  async getUnreadCounts(userId) {
    const counts = await this.redis.hgetall(`unread:${userId}`);
    return Object.entries(counts).reduce((acc, [key, val]) => {
      acc[key] = parseInt(val);
      return acc;
    }, {});
  }
}

export default RedisService;
