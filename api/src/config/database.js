// api/src/config/database.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("❌ MONGODB_URI not found in environment variables");
    }

    // Enhanced connection options for production
    const options = {
      // Connection Pool Configuration
      maxPoolSize: 10, // Maximum number of sockets the MongoDB driver will keep open
      minPoolSize: 2, // Minimum number of sockets to keep open

      // Timeout Configuration
      serverSelectionTimeoutMS: 5000, // How long to wait for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 10000, // Initial connection timeout

      // Retry Configuration
      retryWrites: true, // Retry failed writes once
      retryReads: true, // Retry failed reads once

      // Other Options
      family: 4, // Use IPv4, skip trying IPv6
      autoIndex: process.env.NODE_ENV !== "production", // Don't build indexes in production
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoUri, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection pool size: ${options.maxPoolSize}`);

    // ============ EVENT LISTENERS FOR MONITORING ============

    // Connection successful
    mongoose.connection.on("connected", () => {
      console.log("✅ Mongoose connected to MongoDB");
    });

    // Connection error
    mongoose.connection.on("error", (err) => {
      console.error("❌ Mongoose connection error:", err.message);
      // Don't exit process - let retry logic handle it
    });

    // Disconnected
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ Mongoose disconnected from MongoDB");
    });

    // Reconnected
    mongoose.connection.on("reconnected", () => {
      console.log("✅ Mongoose reconnected to MongoDB");
    });

    // Monitor connection pool
    mongoose.connection.on("open", () => {
      console.log("🔓 MongoDB connection pool opened");
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(
        `\n⚠️ ${signal} received. Closing MongoDB connection gracefully...`
      );
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed gracefully");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during MongoDB shutdown:", error);
        process.exit(1);
      }
    };

    // Listen for termination signals
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    console.error("Stack:", error.stack);

    // In production, you might want to retry instead of exiting
    if (process.env.NODE_ENV === "production") {
      console.log("⏳ Retrying connection in 5 seconds...");
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

// Helper function to check connection health
export const checkDBHealth = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    status: states[state],
    isConnected: state === 1,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
};

export default connectDB;
