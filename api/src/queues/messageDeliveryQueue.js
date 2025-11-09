import { Queue, Worker, QueueEvents } from "bullmq";
import { cacheClient } from "../config/redis.js";
import { connectionManager } from "../sockets/managers/ConnectionManager.js";

/**
 * Message Delivery Queue using BullMQ
 * Handles reliable message delivery with retry logic
 */

// ============ QUEUE CONFIGURATION ============

const queueConnection = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// ============ CREATE QUEUE ============

export const messageDeliveryQueue = new Queue("message-delivery", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 seconds, doubles each retry
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
      count: 5000, // Keep last 5000 failed jobs
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

export const createMessageDeliveryWorker = (io) => {
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
      concurrency: 10, // Process 10 jobs concurrently
      limiter: {
        max: 100, // Max 100 jobs
        duration: 1000, // per second
      },
    }
  );

  // ============ WORKER EVENTS ============

  worker.on("completed", (job) => {
    console.log(`✅ Worker completed job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Worker failed job ${job.id}:`, err.message);

    // Move to dead letter queue after all retries exhausted
    if (job.attemptsMade >= job.opts.attempts) {
      console.error(`☠️ Job ${job.id} moved to dead letter queue`);
      // You can implement custom DLQ handling here
    }
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled (may be retried)`);
  });

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
        priority, // Higher number = higher priority
        jobId: `msg-${messageId}-${userId}`, // Unique job ID prevents duplicates
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
    await messageDeliveryQueue.clean(3600000, 1000, "completed"); // 1 hour
    await messageDeliveryQueue.clean(86400000, 5000, "failed"); // 24 hours
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
