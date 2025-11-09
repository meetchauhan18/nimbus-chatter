import { cacheClient } from '../../config/redis.js';

/**
 * ConnectionManager - Tracks active WebSocket connections
 * Handles user presence, online/offline status, and multi-device support
 */
export class ConnectionManager {
  constructor() {
    this.connections = new Map(); // userId -> Set of socket IDs
    this.sockets = new Map();     // socketId -> socket instance
    this.redis = cacheClient;
  }

  /**
   * Add a new connection
   */
  async addConnection(userId, socket) {
    // Store socket instance
    this.sockets.set(socket.id, socket);

    // Track user connections (multi-device support)
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socket.id);

    // Mark user as online in Redis
    await this.setOnline(userId);

    console.log(`✅ User ${userId} connected (${this.connections.get(userId).size} devices)`);
  }

  /**
   * Remove a connection
   */
  async removeConnection(userId, socketId) {
    this.sockets.delete(socketId);

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);

      // If no more devices connected, mark user offline
      if (userSockets.size === 0) {
        this.connections.delete(userId);
        await this.setOffline(userId);
        console.log(`❌ User ${userId} disconnected (all devices)`);
      } else {
        console.log(`📱 User ${userId} disconnected (${userSockets.size} devices remaining)`);
      }
    }
  }

  /**
   * Get all sockets for a user (multi-device)
   */
  getUserSockets(userId) {
    const socketIds = this.connections.get(userId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(id => this.sockets.get(id))
      .filter(Boolean);
  }

  /**
   * Check if user is online
   */
  isOnline(userId) {
    return this.connections.has(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers() {
    return Array.from(this.connections.keys());
  }

  /**
   * Mark user as online in Redis (for distributed systems)
   */
  async setOnline(userId) {
    try {
      await this.redis.hset('presence:online', userId, Date.now());
      await this.redis.sadd('users:online', userId);
    } catch (error) {
      console.error('Redis setOnline error:', error);
    }
  }

  /**
   * Mark user as offline in Redis
   */
  async setOffline(userId) {
    try {
      const lastSeen = Date.now();
      await this.redis.hdel('presence:online', userId);
      await this.redis.srem('users:online', userId);
      await this.redis.hset('presence:lastseen', userId, lastSeen);
    } catch (error) {
      console.error('Redis setOffline error:', error);
    }
  }

  /**
   * Get user's last seen timestamp
   */
  async getLastSeen(userId) {
    try {
      const lastSeen = await this.redis.hget('presence:lastseen', userId);
      return lastSeen ? parseInt(lastSeen) : null;
    } catch (error) {
      console.error('Redis getLastSeen error:', error);
      return null;
    }
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      totalConnections: this.sockets.size,
      uniqueUsers: this.connections.size,
      avgDevicesPerUser: (this.sockets.size / Math.max(this.connections.size, 1)).toFixed(2)
    };
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
