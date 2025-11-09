// api/src/config/redis.js
import Redis from "ioredis";

// Base Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,

  // Connection retry strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000); // Max 2 seconds
    console.log(`⏳ Redis retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },

  // Reconnect on specific errors
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ECONNREFUSED"];
    return targetErrors.some((targetError) =>
      err.message.includes(targetError)
    );
  },

  // Limits
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Timeouts
  connectTimeout: 10000,
  disconnectTimeout: 2000,
  commandTimeout: 5000,

  // Keep-alive
  keepAlive: 30000,

  // Family
  family: 4, // IPv4
};

// ============ CREATE REDIS CLIENTS ============

// Cache client - for general caching operations
export const cacheClient = new Redis({
  ...redisConfig,
  lazyConnect: false,
  db: 0, // Use database 0
});

// Pub client - for Socket.IO adapter publishing
export const pubClient = new Redis({
  ...redisConfig,
  lazyConnect: false,
  db: 1, // Use separate database for pub/sub
});

// Sub client - for Socket.IO adapter subscribing
export const subClient = pubClient.duplicate();

// ============ EVENT HANDLERS ============

const setupEventHandlers = (client, name) => {
  client.on("connect", () => {
    console.log(`✅ Redis ${name} connecting...`);
  });

  client.on("ready", () => {
    console.log(`✅ Redis ${name} ready`);
  });

  client.on("error", (err) => {
    console.error(`❌ Redis ${name} error:`, err.message);
  });

  client.on("close", () => {
    console.warn(`⚠️ Redis ${name} connection closed`);
  });

  client.on("reconnecting", (delay) => {
    console.log(`⏳ Redis ${name} reconnecting in ${delay}ms...`);
  });

  client.on("end", () => {
    console.log(`🔌 Redis ${name} connection ended`);
  });
};

setupEventHandlers(cacheClient, "Cache");
setupEventHandlers(pubClient, "Publisher");
setupEventHandlers(subClient, "Subscriber");

// ============ CONNECTION HELPER ============

/**
 * Initialize all Redis connections
 */
export const connectRedis = async () => {
  try {
    console.log("🔌 Connecting to Redis...");

    // Test all connections
    await Promise.all([cacheClient.ping(), pubClient.ping(), subClient.ping()]);

    console.log("✅ All Redis clients connected successfully");
    console.log(`📍 Redis host: ${redisConfig.host}:${redisConfig.port}`);

    return true;
  } catch (error) {
    console.error("❌ Redis connection failed:", error.message);
    throw error;
  }
};

/**
 * Check Redis health status
 */
export const checkRedisHealth = async () => {
  try {
    const [cacheStatus, pubStatus, subStatus] = await Promise.all([
      cacheClient
        .ping()
        .then(() => "connected")
        .catch(() => "disconnected"),
      pubClient
        .ping()
        .then(() => "connected")
        .catch(() => "disconnected"),
      subClient
        .ping()
        .then(() => "connected")
        .catch(() => "disconnected"),
    ]);

    return {
      cache: cacheStatus,
      publisher: pubStatus,
      subscriber: subStatus,
      allHealthy:
        cacheStatus === "connected" &&
        pubStatus === "connected" &&
        subStatus === "connected",
    };
  } catch (error) {
    return {
      cache: "error",
      publisher: "error",
      subscriber: "error",
      allHealthy: false,
      error: error.message,
    };
  }
};

/**
 * Graceful shutdown
 */
export const disconnectRedis = async () => {
  console.log("⏳ Closing Redis connections...");

  await Promise.all([cacheClient.quit(), pubClient.quit(), subClient.quit()]);

  console.log("✅ All Redis connections closed");
};

// Graceful shutdown on process termination
process.on("SIGINT", async () => {
  await disconnectRedis();
});

process.on("SIGTERM", async () => {
  await disconnectRedis();
});

// Legacy exports for backward compatibility
export const getCacheClient = () => cacheClient;
export const getPubClient = () => pubClient;
export const getSubClient = () => subClient;
