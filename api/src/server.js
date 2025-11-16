import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";

// Shared kernel imports
import Database from "./shared/database/index.js";
import RedisManager from "./shared/redis/index.js";
import EventBus from "./shared/events/EventBus.js";
import Logger from "./shared/logger/index.js";
import { config } from "./shared/config/index.js";

// Middleware imports
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { hstsMiddleware, httpsRedirect } from "./middleware/httpRedirect.js";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";

// Socket imports
import { initializeSocket } from "./sockets/index.js";

// Initialize logger
const logger = new Logger("Server");

// Initialize shared infrastructure
const database = new Database();
const redisManager = new RedisManager();
let eventBus = null;

// Create Express app
const app = express();
const server = http.createServer(app);

// Security middleware
if (config.env === "production") {
  app.use(httpsRedirect);
  app.use(hstsMiddleware);
}
app.use(helmet());
app.use(cors({ origin: config.client.url, credentials: true }));

// General middleware
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
});
app.use("/api/", limiter);

// Health check
app.get("/health", async (req, res) => {
  const dbHealth = await database.checkHealth();
  const redisHealth = await redisManager.checkHealth();

  const isHealthy = dbHealth.isConnected && redisHealth.status === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/media", mediaRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize infrastructure and start server
async function startServer() {
  try {
    // Connect to database
    await database.connect();

    // Connect to Redis
    const redisClients = await redisManager.connect();
    logger.info("✅ Redis clients ready for Socket.IO");

    // Initialize event bus
    eventBus = new EventBus({
      pubClient: redisClients.pubClient,
      subClient: redisClients.subClient,
      logger: logger.child("EventBus"),
    });
    eventBus.startListening();

    // Store shared kernel in app locals (accessible to all routes)
    app.locals.sharedKernel = {
      database,
      redis: redisClients,
      eventBus,
      logger,
      config,
    };

    // Initialize Socket.IO with shared Redis clients
    const io = initializeSocket(
      server,
      redisClients.pubClient,
      redisClients.subClient,
      redisClients.cacheClient
    );
    app.locals.io = io;

    // Start server
    server.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Environment: ${config.env}`);
      logger.info(`🌐 Client URL: ${config.client.url}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down gracefully...");

  eventBus?.stopListening();
  await database.disconnect();
  await redisManager.disconnect();

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer();
