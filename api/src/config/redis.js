import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST || "redis", // Changed from "localhost"
  port: process.env.REDIS_PORT || 6379,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  maxRetriesPerRequest: 3,
};

const cacheClient = new Redis(redisConfig);
const pubClient = new Redis(redisConfig);
const subClient = new Redis(redisConfig);

cacheClient.on("connect", () => console.log("✅ Redis cache client connected"));
cacheClient.on("error", (err) => console.error("❌ Redis cache error:", err));

export { cacheClient, pubClient, subClient };
