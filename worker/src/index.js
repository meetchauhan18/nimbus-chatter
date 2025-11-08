import { Worker } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const connection = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

console.log("? Worker service started - ready for Phase 1 message processing");

process.on("SIGTERM", () => {
  console.log("?? SIGTERM received, shutting down worker");
  process.exit(0);
});
