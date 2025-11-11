import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // 🧩 Unique client-generated ID for deduplication
    clientMsgId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // 💬 Conversation reference
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    // 👤 Sender
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔁 Reply to another message
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
        "system",
      ],
      required: true,
    },

    // 🧾 Content
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // 🖼️ Media info
    media: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      mimeType: { type: String, default: null },
      size: { type: Number, default: 0 },
      duration: { type: Number, default: null },
      thumbnail: { type: String, default: null },
    },

    // 🧩 Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ⚙️ Status
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "seen", "failed"],
      default: "sent",
    },

    // 📬 Delivery tracking
    deliveredTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // 👀 Seen tracking
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

    // 🗑️ Per-user soft delete
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ⏳ Ephemeral messages
    expiresAt: {
      type: Date,
      default: null,
    },

    // 🔐 E2E encryption
    encryption: {
      cipherText: { type: String, default: null },
      iv: { type: String, default: null },
      keyId: { type: String, default: null },
      version: { type: String, default: "v1" },
    },

    // 🧠 Device info
    deviceInfo: {
      deviceId: { type: String, default: null },
      sentFrom: {
        type: String,
        enum: ["mobile", "web", "desktop"],
        default: "mobile",
      },
    },

    // 🧾 Reactions
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // 📅 System-level delete
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// ============ INDEXES ============
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ "reactions.emoji": 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ status: 1 });
messageSchema.index({ conversationId: 1, isDeleted: 1 });

// ============ MIDDLEWARE ============

// Track edits
messageSchema.pre("save", function (next) {
  if (this.isModified("content") && !this.isNew) {
    this.edited.isEdited = true;
    this.edited.editedAt = Date.now();
  }
  next();
});

// ============ INSTANCE METHODS ============

/**
 * Mark message as delivered to a user
 */
messageSchema.methods.markDelivered = function (userId) {
  const alreadyDelivered = this.deliveredTo.some(
    (d) => d.userId.toString() === userId.toString()
  );
  if (!alreadyDelivered) {
    this.deliveredTo.push({ userId, timestamp: Date.now() });
    if (this.status === "sent") {
      this.status = "delivered";
    }
  }
};

/**
 * Mark message as seen by a user
 */
messageSchema.methods.markSeen = function (userId) {
  const alreadySeen = this.seenBy.some(
    (s) => s.userId.toString() === userId.toString()
  );
  if (!alreadySeen) {
    this.seenBy.push({ userId, timestamp: Date.now() });
    this.status = "seen";

    // Also mark as delivered if not already
    this.markDelivered(userId);
  }
};

/**
 * Check if user can edit (only sender, within 15 mins)
 */
messageSchema.methods.canEdit = function (userId) {
  const fifteenMinutes = 15 * 60 * 1000;
  const timeSinceCreated = Date.now() - this.createdAt.getTime();
  return (
    this.senderId.toString() === userId.toString() &&
    timeSinceCreated < fifteenMinutes &&
    !this.isDeleted &&
    this.deletedFor.length === 0
  );
};

/**
 * Check if user can delete (only sender)
 */
messageSchema.methods.canDelete = function (userId) {
  return (
    this.senderId.toString() === userId.toString() &&
    !this.isDeleted &&
    !this.deletedFor.includes(userId)
  );
};

/**
 * Add reaction
 */
messageSchema.methods.addReaction = function (userId, emoji) {
  const existingReaction = this.reactions.find(
    (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
  );

  if (!existingReaction) {
    this.reactions.push({ userId, emoji, timestamp: Date.now() });
  }
};

/**
 * Remove reaction
 */
messageSchema.methods.removeReaction = function (userId, emoji) {
  this.reactions = this.reactions.filter(
    (r) => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
  );
};

/**
 * Soft delete for specific user
 */
messageSchema.methods.deleteForUser = function (userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
  }
};

/**
 * Hard delete (system-level)
 */
messageSchema.methods.permanentDelete = function () {
  this.isDeleted = true;
  this.content = "This message was deleted";
};

/**
 * Clean output for API
 */
messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;

  // Hide encryption details if present
  if (obj.encryption && !obj.encryption.cipherText) {
    delete obj.encryption;
  }

  return obj;
};

export default mongoose.model("Message", messageSchema);
