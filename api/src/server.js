import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import mongoSanitize from "express-mongo-sanitize";

// Config imports

// Middleware imports
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Route imports
import authRoutes from "./routes/authRoutes.js";

// Socket imports
import { initializeSocket } from "./sockets/index.js";
import connectDB, { checkDBHealth } from "./config/database.js";
import { checkRedisHealth, connectRedis } from "./config/redis.js";
import { hstsMiddleware, httpsRedirect } from "./middleware/httpRedirect.js";
import { getQueueStats } from "./queues/messageDeliveryQueue.js";
import { connectionManager } from "./sockets/managers/ConnectionManager.js";

// Load environment variables
dotenv.config({ path: "../.env" });

const app = express();
const httpServer = http.createServer(app);

// ================== MIDDLEWARE ==================
app.use(helmet());
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

// In production, CLIENT_URL must be explicitly set
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error("❌ SECURITY ERROR: CLIENT_URL must be set in production");
  process.exit(1);
}

// Development fallback
const developmentOrigin = "http://localhost:5173";

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed
      const origins =
        allowedOrigins.length > 0 ? allowedOrigins : [developmentOrigin];

      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(
          `⚠️ CORS blocked request from unauthorized origin: ${origin}`
        );
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight requests for 10 minutes
  })
);
app.use(morgan("dev"));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(httpsRedirect);
app.use(hstsMiddleware);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 requests per window
  message: {
    status: "error",
    message:
      "Too many authentication attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful attempts too
  handler: (req, res) => {
    res.status(429).json({
      status: "error",
      message: "Too many authentication attempts. Please try again later.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});
app.use("/api", authLimiter);

// ================== ROUTES ==================
app.use("/api/auth", authRoutes);

// Health check
app.get("/health", async (req, res) => {
  try {
    const [dbHealth, redisHealth, queueStats, connectionStats] =
      await Promise.all([
        checkDBHealth(),
        checkRedisHealth(),
        getQueueStats(),
        connectionManager.getStats(),
      ]);

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      redis: redisHealth,
      queue: queueStats,
      connections: connectionStats,
      memory: process.memoryUsage(),
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

// ================== SOCKET.IO ==================
const io = initializeSocket(httpServer);

// Make io accessible to routes (if needed)
app.set("io", io);

// ================== START SERVER ==================
const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await connectRedis();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 API server running on port ${PORT}`);
      console.log(`🔌 WebSocket server ready`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
});
