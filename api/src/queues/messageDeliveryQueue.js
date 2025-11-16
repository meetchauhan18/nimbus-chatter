import { Queue, Worker, QueueEvents } from "bullmq";
import { config } from "../shared/config/index.js";

/**
 * Message Delivery Queue using BullMQ
 * NOW ACCEPTS connectionManager instance via dependency injection
 */

// ============ QUEUE CONFIGURATION ============

const queueConnection = {
  host: config.redis.host, // Uses your .env REDIS_HOST
  port: config.redis.port, // Uses your .env REDIS_PORT
  password: config.redis.password, // Uses your .env REDIS_PASSWORD
  maxRetriesPerRequest: null,
  enableOfflineQueue: false, // Fail fast if Redis is down
  connectTimeout: 10000,
  family: 4,
};

// ============ CREATE QUEUE ============

export const messageDeliveryQueue = new Queue("message-delivery", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
      count: 5000,
    },
  },
});

// ============ QUEUE EVENTS ============

const queueEvents = new QueueEvents("message-delivery", {
  connection: queueConnection,
});

queueEvents.on("completed", ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed successfully`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on("progress", ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
});

// ============ WORKER ============

export const createMessageDeliveryWorker = (io, connectionManager) => {
  if (!connectionManager) {
    throw new Error(
      "ConnectionManager is required for message delivery worker"
    );
  }

  const worker = new Worker(
    "message-delivery",
    async (job) => {
      const { userId, event, data, messageId } = job.data;

      console.log(`📤 Processing delivery job ${job.id} for user ${userId}`);

      // Check if user is online
      const isOnline = await connectionManager.isUserOnline(userId);

      if (!isOnline) {
        throw new Error(`User ${userId} is still offline`);
      }

      // Emit via cross-instance pub/sub
      await connectionManager.emitToUser(userId, event, data);

      // Update job progress
      await job.updateProgress(100);

      console.log(`✅ Message ${messageId} delivered to user ${userId}`);

      return { delivered: true, timestamp: Date.now() };
    },
    {
      connection: queueConnection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  // ============ WORKER EVENTS ============

  worker.on("completed", (job) => {
    console.log(`✅ Worker completed job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Worker failed job ${job.id}:`, err.message);

    if (job.attemptsMade >= job.opts.attempts) {
      console.error(`☠️ Job ${job.id} moved to dead letter queue`);
    }
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled (may be retried)`);
  });

  console.log("✅ Message delivery worker initialized");
  return worker;
};

// ============ HELPER FUNCTIONS ============

/**
 * Add message to delivery queue
 */
export async function queueMessageDelivery(
  userId,
  event,
  data,
  messageId,
  priority = 0
) {
  try {
    const job = await messageDeliveryQueue.add(
      "deliver",
      {
        userId,
        event,
        data,
        messageId,
        queuedAt: Date.now(),
      },
      {
        priority,
        jobId: `msg-${messageId}-${userId}`,
      }
    );

    console.log(
      `📬 Queued message ${messageId} for user ${userId} (Job: ${job.id})`
    );
    return job;
  } catch (error) {
    console.error("Error queuing message:", error);
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      messageDeliveryQueue.getWaitingCount(),
      messageDeliveryQueue.getActiveCount(),
      messageDeliveryQueue.getCompletedCount(),
      messageDeliveryQueue.getFailedCount(),
      messageDeliveryQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  } catch (error) {
    console.error("Error getting queue stats:", error);
    return null;
  }
}

/**
 * Clean old jobs
 */
export async function cleanOldJobs() {
  try {
    await messageDeliveryQueue.clean(3600000, 1000, "completed");
    await messageDeliveryQueue.clean(86400000, 5000, "failed");
    console.log("🧹 Cleaned old queue jobs");
  } catch (error) {
    console.error("Error cleaning jobs:", error);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("⏳ Closing message delivery queue...");
  await messageDeliveryQueue.close();
  console.log("✅ Queue closed");
});
