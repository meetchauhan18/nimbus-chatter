// api/src/sockets/managers/ConnectionManager.js
import { cacheClient } from "../../config/redis.js";

/**
 * ConnectionManager - Redis-backed connection tracking
 * Enables horizontal scaling across multiple server instances
 * All connection state stored in Redis for distributed consistency
 */
export class ConnectionManager {
  constructor() {
    this.redis = cacheClient;
    this.localSockets = new Map(); // socketId -> socket instance (local only)
    this.CONNECTION_TTL = 60 * 60 * 24; // 24 hours
    this.PRESENCE_TTL = 60 * 5; // 5 minutes
    this.instanceId = `instance-${process.env.INSTANCE_ID || Math.random().toString(36).substr(2, 9)}`;

    console.log(`🔌 ConnectionManager initialized: ${this.instanceId}`);
  }

  /**
   * Add a new connection - fully Redis-backed
   */
  async addConnection(userId, socket) {
    try {
      const socketId = socket.id;

      // Store socket locally for this instance only
      this.localSockets.set(socketId, socket);

      // Store in Redis: userId -> Set of socketIds across all instances
      await this.redis.sadd(`user:sockets:${userId}`, socketId);
      await this.redis.expire(`user:sockets:${userId}`, this.CONNECTION_TTL);

      // Store reverse mapping: socketId -> userId
      await this.redis.setex(
        `socket:user:${socketId}`,
        this.CONNECTION_TTL,
        userId
      );

      // Store which instance handles this socket
      await this.redis.setex(
        `socket:instance:${socketId}`,
        this.CONNECTION_TTL,
        this.instanceId
      );

      // Mark user as online
      await this.setOnline(userId);

      // Get total device count across all instances
      const deviceCount = await this.redis.scard(`user:sockets:${userId}`);
      console.log(
        `✅ User ${userId} connected on ${this.instanceId} (${deviceCount} total devices)`
      );

      return true;
    } catch (error) {
      console.error("ConnectionManager addConnection error:", error);
      return false;
    }
  }

  /**
   * Remove a connection
   */
  async removeConnection(userId, socketId) {
    try {
      // Remove from local storage
      this.localSockets.delete(socketId);

      // Remove from Redis
      await this.redis.srem(`user:sockets:${userId}`, socketId);
      await this.redis.del(`socket:user:${socketId}`);
      await this.redis.del(`socket:instance:${socketId}`);

      // Check if user still has active connections
      const remainingDevices = await this.redis.scard(`user:sockets:${userId}`);

      if (remainingDevices === 0) {
        await this.setOffline(userId);
        console.log(
          `❌ User ${userId} disconnected from ${this.instanceId} (all devices offline)`
        );
      } else {
        console.log(
          `📱 User ${userId} disconnected from ${this.instanceId} (${remainingDevices} devices remaining)`
        );
      }

      return true;
    } catch (error) {
      console.error("ConnectionManager removeConnection error:", error);
      return false;
    }
  }

  /**
   * Get all socket IDs for a user (across all instances)
   */
  async getUserSocketIds(userId) {
    try {
      const socketIds = await this.redis.smembers(`user:sockets:${userId}`);
      return socketIds || [];
    } catch (error) {
      console.error("ConnectionManager getUserSocketIds error:", error);
      return [];
    }
  }

  /**
   * Get local sockets for a user (only on this instance)
   */
  getLocalUserSockets(userId) {
    const sockets = [];
    for (const [socketId, socket] of this.localSockets.entries()) {
      if (socket.userId === userId) {
        sockets.push(socket);
      }
    }
    return sockets;
  }

  /**
   * Check if user is online (across all instances)
   */
  async isUserOnline(userId) {
    try {
      const socketCount = await this.redis.scard(`user:sockets:${userId}`);
      return socketCount > 0;
    } catch (error) {
      console.error("ConnectionManager isUserOnline error:", error);
      return false;
    }
  }

  /**
   * Get which instance handles a specific socket
   */
  async getSocketInstance(socketId) {
    try {
      return await this.redis.get(`socket:instance:${socketId}`);
    } catch (error) {
      console.error("ConnectionManager getSocketInstance error:", error);
      return null;
    }
  }

  /**
   * Emit to user across all instances via Redis pub/sub
   */
  async emitToUser(userId, event, data) {
    try {
      const message = {
        targetUserId: userId,
        event,
        data,
        fromInstance: this.instanceId,
        timestamp: Date.now(),
      };

      // Publish to Redis channel - all instances will receive this
      await this.redis.publish("socket:emit", JSON.stringify(message));

      return true;
    } catch (error) {
      console.error("ConnectionManager emitToUser error:", error);
      return false;
    }
  }

  /**
   * Subscribe to cross-instance messages
   */
  subscribeToEmits(io) {
    // Create subscriber client
    const subscriber = this.redis.duplicate();

    subscriber.subscribe("socket:emit", (err) => {
      if (err) {
        console.error("Failed to subscribe to socket:emit:", err);
      } else {
        console.log("✅ Subscribed to cross-instance socket emissions");
      }
    });

    subscriber.on("message", async (channel, message) => {
      try {
        const { targetUserId, event, data, fromInstance } = JSON.parse(message);

        // Only emit if this instance has sockets for the target user
        const localSockets = this.getLocalUserSockets(targetUserId);

        if (localSockets.length > 0) {
          console.log(
            `📨 Relaying event "${event}" to ${localSockets.length} local sockets from ${fromInstance}`
          );
          localSockets.forEach((socket) => {
            socket.emit(event, data);
          });
        }
      } catch (error) {
        console.error("Error processing cross-instance message:", error);
      }
    });

    return subscriber;
  }

  /**
   * Mark user as online with presence
   */
  async setOnline(userId) {
    try {
      const now = Date.now();

      // Add to online users set
      await this.redis.sadd("users:online", userId);

      // Store presence with timestamp
      await this.redis.hset("presence:online", userId, now);
      await this.redis.expire("presence:online", this.PRESENCE_TTL);

      // Remove from last seen (if exists)
      await this.redis.hdel("presence:lastseen", userId);

      return true;
    } catch (error) {
      console.error("ConnectionManager setOnline error:", error);
      return false;
    }
  }

  /**
   * Mark user as offline with last seen
   */
  async setOffline(userId) {
    try {
      const now = Date.now();

      // Remove from online users
      await this.redis.srem("users:online", userId);
      await this.redis.hdel("presence:online", userId);

      // Store last seen timestamp
      await this.redis.hset("presence:lastseen", userId, now);
      await this.redis.expire("presence:lastseen", 60 * 60 * 24 * 7); // 7 days

      return true;
    } catch (error) {
      console.error("ConnectionManager setOffline error:", error);
      return false;
    }
  }

  /**
   * Get user presence information
   */
  async getPresence(userId) {
    try {
      const isOnline = await this.redis.sismember("users:online", userId);

      if (isOnline) {
        const onlineTimestamp = await this.redis.hget(
          "presence:online",
          userId
        );
        return {
          status: "online",
          since: onlineTimestamp ? parseInt(onlineTimestamp) : null,
        };
      }

      const lastSeen = await this.redis.hget("presence:lastseen", userId);
      return {
        status: "offline",
        lastSeen: lastSeen ? parseInt(lastSeen) : null,
      };
    } catch (error) {
      console.error("ConnectionManager getPresence error:", error);
      return { status: "unknown", lastSeen: null };
    }
  }

  /**
   * Get bulk presence for multiple users
   */
  async getBulkPresence(userIds) {
    try {
      const pipeline = this.redis.pipeline();

      userIds.forEach((userId) => {
        pipeline.sismember("users:online", userId);
      });

      const results = await pipeline.exec();

      return userIds.map((userId, index) => ({
        userId,
        isOnline: results[index][1] === 1,
      }));
    } catch (error) {
      console.error("ConnectionManager getBulkPresence error:", error);
      return [];
    }
  }

  /**
   * Get all online users
   */
  async getOnlineUsers() {
    try {
      return await this.redis.smembers("users:online");
    } catch (error) {
      console.error("ConnectionManager getOnlineUsers error:", error);
      return [];
    }
  }

  /**
   * Get connection statistics
   */
  async getStats() {
    try {
      const [totalOnlineUsers, localConnectionCount] = await Promise.all([
        this.redis.scard("users:online"),
        Promise.resolve(this.localSockets.size),
      ]);

      return {
        instanceId: this.instanceId,
        localConnections: localConnectionCount,
        totalOnlineUsers,
        avgDevicesPerUser:
          totalOnlineUsers > 0
            ? (localConnectionCount / totalOnlineUsers).toFixed(2)
            : 0,
      };
    } catch (error) {
      console.error("ConnectionManager getStats error:", error);
      return null;
    }
  }

  /**
   * Cleanup orphaned connections (connections that weren't properly closed)
   */
  async cleanupOrphanedConnections() {
    try {
      const pattern = "user:sockets:*";
      const keys = await this.redis.keys(pattern);

      let cleaned = 0;

      for (const key of keys) {
        const socketIds = await this.redis.smembers(key);

        for (const socketId of socketIds) {
          // Check if socket instance still exists
          const instance = await this.redis.get(`socket:instance:${socketId}`);

          if (!instance) {
            // Socket is orphaned - remove it
            await this.redis.srem(key, socketId);
            cleaned++;
          }
        }

        // If no sockets remain, delete the key
        const remaining = await this.redis.scard(key);
        if (remaining === 0) {
          await this.redis.del(key);
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} orphaned socket connections`);
      }

      return cleaned;
    } catch (error) {
      console.error(
        "ConnectionManager cleanupOrphanedConnections error:",
        error
      );
      return 0;
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
