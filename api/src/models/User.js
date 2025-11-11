import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    // 📱 Primary Identifier
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email format",
      },
      index: true,
    },

    // 🧑💼 Profile Information
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      sparse: false,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-zA-Z0-9._-]+$/,
        "Username can only contain letters, numbers, dots, underscores, and hyphens",
      ],
      index: true,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    about: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "Hey there! I am using Nimbus Messenger.",
    },

    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // 🔐 Authentication
    password: {
      type: String,
      required: true,
      select: false, // Don't return password by default
      minlength: 8,
      maxlength: 128,
      // REMOVED THE VALIDATOR - Validation happens in Joi schema BEFORE hashing
    },

    // 🌐 Status & Presence
    status: {
      type: String,
      enum: ["online", "offline", "away", "busy"],
      default: "offline",
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // 🔒 Privacy Settings
    privacy: {
      lastSeen: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      profilePhoto: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      about: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
    },

    // 👥 Contacts & Blocks
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 📱 Push Notifications
    deviceTokens: [
      {
        token: String,
        platform: { type: String, enum: ["ios", "android", "web"] },
        lastUsed: { type: Date, default: Date.now },
      },
    ],
    // 🔐 Password Reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ✉️ Email Verification
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============ INDEXES ============
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ status: 1, lastSeen: -1 });

// ============ MIDDLEWARE ============

// Hash password before saving - ONLY if password is modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    // Password validation happens in Joi before this point
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Set displayName to username if not provided
userSchema.pre("save", function (next) {
  if (!this.displayName) {
    this.displayName = this.username;
  }
  next();
});

// ============ METHODS ============

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};


export default mongoose.model("User", userSchema);
