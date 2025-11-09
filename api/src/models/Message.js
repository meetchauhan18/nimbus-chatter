import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // 🧩 Unique client-generated ID for deduplication (important for offline retries)
    clientMsgId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // 💬 Which conversation this message belongs to
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    // 👤 Who sent it
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔁 Reply to another message (for threaded messages)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // 🧠 Message type
    type: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "file",
        "emoji",
        "contact",
        "location",
        "system", // e.g. "user added", "group name changed"
      ],
      required: true,
    },

    // 🧾 Actual content (supports text or structured payloads)
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // 🖼️ Media info (for non-text messages)
    media: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // Cloudinary / CDN reference
      mimeType: { type: String, default: null },
      size: { type: Number, default: 0 }, // bytes
      duration: { type: Number, default: null }, // for audio/video
      thumbnail: { type: String, default: null }, // base64 or CDN
    },

    // 🧩 System or contextual metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ⚙️ Message lifecycle status
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "seen", "failed"],
      default: "sent",
    },

    // 📬 Delivery tracking (multi-device & group safe)
    deliveredTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // 👀 Seen tracking (per user, like blue ticks)
    seenBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // ✏️ Editing support
    edited: {
      isEdited: { type: Boolean, default: false },
      editedAt: { type: Date, default: null },
    },

    // 🗑️ Message deletion (per user soft delete)
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ⏳ Optional ephemeral (auto-expiring) message settings
    expiresAt: {
      type: Date,
      default: null,
    },

    // 🔐 E2E encryption data
    encryption: {
      cipherText: { type: String, default: null },
      iv: { type: String, default: null },
      keyId: { type: String, default: null },
      version: { type: String, default: "v1" },
    },

    // 🧠 Device origin (for multi-device sync)
    deviceInfo: {
      deviceId: { type: String, default: null },
      sentFrom: {
        type: String,
        enum: ["mobile", "web", "desktop"],
        default: "mobile",
      },
    },

    // 🧾 Reactions (❤️ 😂 👍 etc.)
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // 📅 Soft delete (system-level, not per user)
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

//
// 🧩 Indexes for performance-critical queries
//
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ "reactions.emoji": 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ status: 1 });

//
// 🧠 Schema Middleware
//

// Keep track of edited state
messageSchema.pre("save", function (next) {
  if (this.isModified("content") && !this.isNew) {
    this.edited.isEdited = true;
    this.edited.editedAt = Date.now();
  }
  next();
});

//
// 🚀 Utility methods
//

// Mark message as delivered to a user
messageSchema.methods.markDelivered = function (userId) {
  const alreadyDelivered = this.deliveredTo.some(
    (d) => d.userId.toString() === userId.toString()
  );
  if (!alreadyDelivered) {
    this.deliveredTo.push({ userId, timestamp: Date.now() });
    this.status = "delivered";
  }
};

// Mark message as seen by a user
messageSchema.methods.markSeen = function (userId) {
  const alreadySeen = this.seenBy.some(
    (s) => s.userId.toString() === userId.toString()
  );
  if (!alreadySeen) {
    this.seenBy.push({ userId, timestamp: Date.now() });
    this.status = "seen";
  }
};

// Clean output for API responses
messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};


export default mongoose.model("Message", messageSchema);