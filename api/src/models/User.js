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

    // 🧑‍💼 Profile Information
    username: {
      type: String,
      required: true, // Changed from optional to required
      trim: true,
      unique: true,
      sparse: false, // Changed from sparse: true
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
      publicId: { type: String, default: null }, // Cloudinary ID
    },

    // 🔐 Authentication
    password: {
      type: String,
      required: true,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
      validate: {
        validator: function (password) {
          // Strong password: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
          const strongPasswordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~]{8,}$/;
          return strongPasswordRegex.test(password);
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#, etc.)",
      },
    },
    passwordChangedAt: { type: Date },

    // 🔑 Security Keys (for E2E and devices)
    publicKey: { type: String, default: null },
    deviceKeys: [
      {
        deviceId: { type: String, required: true },
        publicKey: { type: String, required: true },
        lastActive: { type: Date, default: Date.now },
      },
    ],

    // 🟢 Presence
    status: {
      type: String,
      enum: ["online", "offline", "away"],
      default: "offline",
    },
    lastSeen: { type: Date, default: Date.now },

    // 👥 Contacts / Social Graph
    contacts: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        isBlocked: { type: Boolean, default: false },
        lastInteraction: { type: Date, default: Date.now },
      },
    ],

    // 🔏 Privacy
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
      readReceipts: { type: Boolean, default: true },
    },

    // 💻 Device Info
    devices: [
      {
        deviceId: { type: String, required: true },
        deviceType: {
          type: String,
          enum: ["mobile", "web", "desktop"],
          required: true,
        },
        lastActive: { type: Date, default: Date.now },
        pushToken: { type: String, default: null },
      },
    ],

    // 🧠 System Fields
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, select: false },
    verificationExpiry: { type: Date, select: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

//
// ⚡ Indexes (no duplicates)
//
userSchema.index({ "devices.deviceId": 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ status: 1, lastSeen: -1 });

//
// 🧂 Password Hash Middleware
//
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

//
// 🔑 Compare Password
//
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

//
// 🕵️ Check if password changed after token issue
//
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

//
// 🔐 Generate 6-digit Verification Code (OTP)
//
userSchema.methods.generateVerificationCode = function () {
  const code = crypto.randomInt(100000, 999999).toString();
  this.verificationCode = code;
  this.verificationExpiry = Date.now() + 10 * 60 * 1000; // expires in 10 min
  return code;
};

//
// 🚀 Sanitize Response
//
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationCode;
  delete obj.verificationExpiry;
  delete obj.__v;
  return obj;
};

//
// ✅ Export model
//
const User = mongoose.model("User", userSchema);
export default User;
