import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import dotenv from "dotenv";
import { cacheClient, pubClient, subClient } from "./config/redis.js";
import { verifyAccessToken } from "./config/jwt.js";
import Conversation from "./models/Conversation.js";
import User from "./models/user.js";
import { createAdapter } from "@socket.io/redis-adapter";    

// ✅ Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Load .env from project root (works in Docker and local)
dotenv.config({
  path: join(__dirname, "../../.env"),
});

const app = express();

// ✅ Connect to MongoDB
await connectDB();

// ✅ Middleware stack
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// ✅ Rate limiting (protect API routes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // limit each IP
});
app.use("/api/", limiter);

// ✅ Health check routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/readiness", async (req, res) => {
  const checks = { mongodb: false, redis: false };

  try {
    // Check MongoDB connection
    checks.mongodb = mongoose.connection.readyState === 1;

    // Check Redis connectivity
    await cacheClient.ping();
    checks.redis = true;

    if (checks.mongodb && checks.redis) {
      return res.json({ status: "ready", checks });
    } else {
      return res.status(503).json({ status: "not ready", checks });
    }
  } catch (error) {
    return res.status(503).json({
      status: "error",
      checks,
      error: error.message,
    });
  }
});

// ✅ Routes
app.use("/api/auth", authRoutes);

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "development" ? err.message : "Server error",
  });
});

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// In Socket.IO setup
if (pubClient && subClient) {
  try {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✅ Socket.IO Redis adapter initialized");
  } catch (error) {
    console.warn("⚠️ Redis adapter not initialized:", error.message);
  }
}

// ✅ Socket.IO Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    console.error("❌ Socket Auth Error:", error.message);
    next(new Error("Authentication failed"));
  }
});

// ✅ Socket.IO Connection handler
io.on("connection", async (socket) => {
  console.log(`⚡ User connected: ${socket.userId}`);

  // Join personal room
  socket.join(`user:${socket.userId}`);

  // Update user online status
  await User.findByIdAndUpdate(socket.userId, { status: "online" });

  // Join all conversation rooms
  const conversations = await Conversation.find({
    participants: socket.userId,
  }).select("_id");

  conversations.forEach((conv) => {
    socket.join(`conversation:${conv._id}`);
  });

  // Broadcast that the user is online
  socket.broadcast.emit("user:online", { userId: socket.userId });

  // ✅ Handle disconnection
  socket.on("disconnect", async () => {
    console.log(`❌ User disconnected: ${socket.userId}`);

    // Delay before marking offline (to handle quick reconnects)
    setTimeout(async () => {
      const sockets = await io.in(`user:${socket.userId}`).fetchSockets();

      if (sockets.length === 0) {
        await User.findByIdAndUpdate(socket.userId, {
          status: "offline",
          lastSeen: new Date(),
        });

        socket.broadcast.emit("user:offline", {
          userId: socket.userId,
          lastSeen: new Date(),
        });
      }
    }, 120000); // 2 minutes
  });
});

// ✅ Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});

// ✅ Export for use in other modules
export { io };
export default app;
