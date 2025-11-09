import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
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

// ADD THESE EXPORTS:
export const connectRedis = async () => {
  await Promise.all([
    cacheClient.ping(),
    pubClient.ping(),
    subClient.ping()
  ]);
  console.log('✅ All Redis clients initialized');
};

export const getCacheClient = () => cacheClient;
export const getPubClient = () => pubClient;
export const getSubClient = () => subClient;

// Keep your original exports too
export { cacheClient, pubClient, subClient };
