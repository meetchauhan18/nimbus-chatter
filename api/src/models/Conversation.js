import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    // 🗂 Type of chat: direct (1:1) or group
    type: {
      type: String,
      enum: ['direct', 'group', 'broadcast'],
      required: true,
    },

    // 👥 Participants (for direct or group)
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        joinedAt: { type: Date, default: Date.now },
        role: {
          type: String,
          enum: ['member', 'admin', 'owner'],
          default: 'member',
        },
        isMuted: { type: Boolean, default: false },
        pinned: { type: Boolean, default: false },
        lastReadMessage: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Message',
          default: null,
        },
      },
    ],

    // 👑 For groups — who manages
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // 🧩 Metadata for group chats
    group: {
      name: { type: String, trim: true, default: null },
      description: { type: String, trim: true, maxlength: 300 },
      avatar: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      inviteLink: { type: String, default: null },
      isArchived: { type: Boolean, default: false },
    },

    // 💬 Message summary
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    // 🔕 Per-user unread message counts
    unreadCount: {
      type: Map,
      of: Number, // key: userId, value: count
      default: {},
    },

    // 📦 Chat Settings
    settings: {
      isEphemeral: { type: Boolean, default: false }, // like disappearing messages
      messageTTL: { type: Number, default: null }, // time to live in seconds
      allowReplies: { type: Boolean, default: true },
    },

    // 🔒 Privacy
    visibility: {
      type: String,
      enum: ['visible', 'hidden', 'archived'],
      default: 'visible',
    },

    // 🧠 System Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

//
// 🧩 Virtual for direct chat name (auto-resolves other user)
//
conversationSchema.virtual('displayName').get(function () {
  if (this.type === 'direct') return 'Direct Chat';
  return this.group?.name || 'Unnamed Group';
});

//
// 🧂 Middleware: Keep lastMessageAt in sync
//
conversationSchema.pre('save', function (next) {
  if (this.isModified('lastMessage')) {
    this.lastMessageAt = Date.now();
  }
  next();
});

//
// 🧠 Indexes for performance
//
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ 'group.name': 'text' });
conversationSchema.index({ createdBy: 1 });
conversationSchema.index({ 'participants.user': 1, type: 1 });

//
// 🚀 Utility Methods
//

// Update unread count for a participant
conversationSchema.methods.incrementUnread = function (userId) {
  const current = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), current + 1);
};

// Reset unread count for a participant
conversationSchema.methods.resetUnread = function (userId) {
  this.unreadCount.set(userId.toString(), 0);
};

// Check if a user is admin
conversationSchema.methods.isAdmin = function (userId) {
  return this.admins?.some((adminId) => adminId.toString() === userId.toString());
};

// Add new participant (for group)
conversationSchema.methods.addParticipant = function (userId, role = 'member') {
  if (!this.participants.some((p) => p.user.toString() === userId.toString())) {
    this.participants.push({ user: userId, role });
  }
};


export default mongoose.model('Conversation', conversationSchema);