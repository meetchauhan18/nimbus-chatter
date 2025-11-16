import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";

// Registry bootstrap
import { initRegistry } from "./bootstrap/initRegistry.js";
import { registryContext } from "./core/middleware/registryContext.js";

// Module imports
import authModule from "./modules/auth/index.js";
import messageModule from "./modules/message/index.js";
import conversationModule from "./modules/conversation/index.js";

// Middleware imports (KEEP - not yet migrated)
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { hstsMiddleware, httpsRedirect } from "./middleware/httpRedirect.js";

// Legacy route imports (fallback only)
import conversationRoutes from "./routes/conversationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";

// Socket imports (KEEP - not yet migrated)
import { initializeSocket } from "./sockets/index.js";

async function startServer() {
  try {
    // ===== PHASE 3: Registry + Module Loading =====
    console.log("🔧 Phase 3: Initializing registry with modules...");
    const registry = await initRegistry();
    await registry.registerModule(authModule);
    await registry.registerModule(messageModule);
    await registry.registerModule(conversationModule);
    console.log("✅ Phase 3 complete: Registry initialized with modules\n");

    // Resolve core services
    const logger = await registry.resolveAsync("core.logger");
    const config = await registry.resolveAsync("core.config");
    const database = await registry.resolveAsync("core.database");
    const redis = await registry.resolveAsync("core.redis");

    // Create Express app
    const app = express();
    const server = http.createServer(app);

    // ===== Inject Registry into Request Context =====
    app.use(registryContext(registry));

    // ===== Security middleware =====
    if (config.env === "production") {
      app.use(httpsRedirect);
      app.use(hstsMiddleware);
    }

    app.use(helmet());
    app.use(cors({ origin: config.client.url, credentials: true }));

    // ===== General middleware =====
    app.use(compression());
    app.use(morgan("dev"));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // ===== Rate limiting =====
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: "Too many requests from this IP",
    });
    app.use("/api/", limiter);

    // ===== Health check (Registry-aware) =====
    app.get("/health", async (req, res) => {
      try {
        const dbHealth = await database.checkHealth();
        const redisHealth = await redis.checkHealth();
        const isHealthy =
          dbHealth.isConnected && redisHealth.status === "connected";

        // Count loaded modules
        const moduleCount = Array.from(registry._modules.keys()).filter(
          (name) => name !== "core"
        ).length;

        res.status(isHealthy ? 200 : 503).json({
          status: isHealthy ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          services: {
            database: dbHealth,
            redis: redisHealth,
            registry: {
              servicesRegistered: registry.listServices().length,
              modulesLoaded: moduleCount,
            },
          },
        });
      } catch (error) {
        logger.error("Health check failed:", error);
        res.status(503).json({
          status: "unhealthy",
          error: error.message,
        });
      }
    });

    // ===== DYNAMIC ROUTE MOUNTING (Module-first, fallback to legacy) ===== 

    // Mount auth Routes 
    if (registry.has("auth.routes")) {
      const authRoutes = await registry.resolveAsync("auth.routes");
      app.use("/api/auth", authRoutes);
      logger.info("✅ Mounted: /api/auth (from auth module)");
    } else {
      const legacyAuthRoutes = await import("./routes/authRoutes.js");
      app.use("/api/auth", legacyAuthRoutes.default);
      logger.warn("⚠️  Mounted: /api/auth (legacy fallback)");
    }

    // Mount message routes
    if (registry.has("message.routes")) {
      const messageRoutes = await registry.resolveAsync("message.routes");
      app.use("/api/messages", messageRoutes);
      logger.info("✅ Mounted message routes");
    } else {
      // Fallback to legacy routes
      const legacyMessageRoutes = await import("./routes/messageRoutes.js");
      app.use("/api/messages", legacyMessageRoutes.default);
      logger.warn("⚠️ Using legacy message routes");
    }

    // Mount conversation routes
    if (registry.has("conversation.routes")) {
      const conversationRoutes = await registry.resolveAsync(
        "conversation.routes"
      );
      app.use("/api/conversations", conversationRoutes);
      logger.info("✅ Mounted conversation routes");
    } else {
      // Fallback to legacy routes
      const legacyConversationRoutes = await import(
        "./routes/conversationRoutes.js"
      );
      app.use("/api/conversations", legacyConversationRoutes.default);
      logger.warn("⚠️ Using legacy conversation routes");
    }

    // User Routes (legacy for now)
    app.use("/api/users", userRoutes);
    logger.info("📦 Mounted: /api/users (legacy)");

    // Profile Routes (legacy for now)
    app.use("/api/profile", profileRoutes);
    logger.info("📦 Mounted: /api/profile (legacy)");

    // Media Routes (legacy for now)
    app.use("/api/media", mediaRoutes);
    logger.info("📦 Mounted: /api/media (legacy)");

    // ===== Error handling =====
    app.use(notFoundHandler);
    app.use(errorHandler);

    // ===== Initialize Socket.IO (still passes clients directly) =====
    const io = initializeSocket(
      server,
      redis.pubClient,
      redis.subClient,
      redis.cacheClient
    );

    // Store io in app.locals for backward compatibility
    app.locals.io = io;

    // ===== Start server =====
    server.listen(config.port, () => {
      logger.info("═══════════════════════════════════════════");
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Environment: ${config.env}`);
      logger.info(`🌐 Client URL: ${config.client.url}`);
      logger.info(`═══════════════════════════════════════════`);
      logger.info(`📦 Registry Statistics:`);
      logger.info(`   • Services: ${registry.listServices().length}`);
      logger.info(
        `   • Modules: ${Array.from(registry._modules.keys()).join(", ")}`
      );
      logger.info("═══════════════════════════════════════════");
    });

    // ===== Graceful shutdown =====
    const shutdown = async () => {
      logger.info("🛑 Shutting down gracefully...");

      // Close server first
      server.close(async () => {
        try {
          // Destroy all modules in reverse order
          const modules = Array.from(registry._modules.keys()).reverse();
          for (const moduleName of modules) {
            const module = registry._modules.get(moduleName);
            if (module.definition.destroy) {
              logger.info(`Destroying module: ${moduleName}`);
              await module.definition.destroy(registry);
            }
          }

          logger.info("✅ Graceful shutdown complete");
          process.exit(0);
        } catch (error) {
          logger.error("Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error("❌ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Handle uncaught errors
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      shutdown();
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

startServer();
