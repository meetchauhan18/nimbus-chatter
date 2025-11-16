import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/user.js";

/**
 * Database Index Migration
 * Run this once to create all necessary indexes for optimal performance
 */

export async function addIndexes() {
  console.log("🚀 Starting database index creation...\n");

  try {
    // ==================== MESSAGE INDEXES ====================
    console.log("📨 Creating Message indexes...");

    // Compound index for conversation queries (most common query pattern)
    await Message.collection.createIndex(
      { conversationId: 1, createdAt: -1, isDeleted: 1 },
      { name: "conversation_messages_idx", background: true }
    );
    console.log("  ✅ conversation_messages_idx");

    // Index for user's sent messages
    await Message.collection.createIndex(
      { senderId: 1, createdAt: -1 },
      { name: "sender_messages_idx", background: true }
    );
    console.log("  ✅ sender_messages_idx");

    // Unique index on clientMsgId (already exists in schema, but ensure it)
    await Message.collection.createIndex(
      { clientMsgId: 1 },
      { unique: true, name: "client_msg_id_unique_idx", background: true }
    );
    console.log("  ✅ client_msg_id_unique_idx");

    // Index for delivery status queries
    await Message.collection.createIndex(
      { status: 1, createdAt: -1 },
      { name: "message_status_idx", background: true }
    );
    console.log("  ✅ message_status_idx");

    // Index for ephemeral messages (TTL index)
    await Message.collection.createIndex(
      { expiresAt: 1 },
      {
        name: "expires_at_ttl_idx",
        expireAfterSeconds: 0,
        background: true,
      }
    );
    console.log("  ✅ expires_at_ttl_idx (TTL index)");

    // ==================== CONVERSATION INDEXES ====================
    console.log("\n💬 Creating Conversation indexes...");

    // Compound index for user's conversations
    await Conversation.collection.createIndex(
      { "participants.user": 1, lastMessageAt: -1 },
      { name: "user_conversations_idx", background: true }
    );
    console.log("  ✅ user_conversations_idx");

    // Index for recent conversations
    await Conversation.collection.createIndex(
      { lastMessageAt: -1 },
      { name: "recent_conversations_idx", background: true }
    );
    console.log("  ✅ recent_conversations_idx");

    // Index for conversation type queries
    await Conversation.collection.createIndex(
      { type: 1, createdAt: -1 },
      { name: "conversation_type_idx", background: true }
    );
    console.log("  ✅ conversation_type_idx");

    // Index for group conversations
    await Conversation.collection.createIndex(
      { "group.name": 1 },
      {
        name: "group_name_idx",
        sparse: true, // Only index documents with group.name
        background: true,
      }
    );
    console.log("  ✅ group_name_idx (sparse)");

    // ==================== USER INDEXES ====================
    console.log("\n👤 Creating User indexes...");

    // Compound index for active users
    await User.collection.createIndex(
      { phone: 1, isDeleted: 1 },
      { name: "phone_active_users_idx", background: true }
    );
    console.log("  ✅ phone_active_users_idx");

    // Unique sparse index on username (already in schema, but ensure it)
    await User.collection.createIndex(
      { username: 1 },
      {
        unique: true,
        sparse: true, // Allow null usernames
        name: "username_unique_idx",
        background: true,
      }
    );
    console.log("  ✅ username_unique_idx (sparse)");

    // Index for presence/online status queries
    await User.collection.createIndex(
      { "presence.isOnline": 1, "presence.lastSeen": -1 },
      { name: "user_presence_idx", background: true }
    );
    console.log("  ✅ user_presence_idx");

    // Index for device queries
    await User.collection.createIndex(
      { "devices.deviceId": 1 },
      {
        name: "user_devices_idx",
        sparse: true,
        background: true,
      }
    );
    console.log("  ✅ user_devices_idx (sparse)");

    // ==================== VERIFICATION ====================
    console.log("\n🔍 Verifying indexes...\n");

    const messageIndexes = await Message.collection.getIndexes();
    const conversationIndexes = await Conversation.collection.getIndexes();
    const userIndexes = await User.collection.getIndexes();

    console.log("📊 Index Summary:");
    console.log(`  Messages: ${Object.keys(messageIndexes).length} indexes`);
    console.log(
      `  Conversations: ${Object.keys(conversationIndexes).length} indexes`
    );
    console.log(`  Users: ${Object.keys(userIndexes).length} indexes`);

    console.log("\n✅ All indexes created successfully!\n");
    return true;
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  }
}

/**
 * Remove indexes (for rollback or testing)
 */
export async function removeIndexes() {
  console.log("🗑️ Removing custom indexes...\n");

  try {
    // Remove all except _id index
    await Message.collection.dropIndexes();
    await Conversation.collection.dropIndexes();
    await User.collection.dropIndexes();

    console.log("✅ Indexes removed successfully");
  } catch (error) {
    console.error("❌ Error removing indexes:", error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  import("dotenv/config");

  const command = process.argv[2];

  await mongoose.connect(process.env.MONGODB_URI);

  if (command === "remove") {
    await removeIndexes();
  } else {
    await addIndexes();
  }

  await mongoose.disconnect();
  process.exit(0);
}