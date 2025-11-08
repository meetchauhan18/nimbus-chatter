import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    // 📱 Primary Identifier
    phone: {
      type: String,
      required: true,
      unique: true, // creates index automatically
      trim: true,
      validate: {
        validator: (v) => /^\+[1-9]\d{1,14}$/.test(v),
        message: "Phone must be valid E.164 format",
      },
    },

    // 🧑‍💼 Profile Information
    username: {
      type: String,
      trim: true,
      unique: true, // creates index automatically
      sparse: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-zA-Z0-9._-]+$/,
        "Username can only contain letters, numbers, dots, underscores, and hyphens",
      ],
    },
    displayName: {
      type: String,
      required: true,
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
      minlength: 8,
      select: false,
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
userSchema.index({ status: 1, lastSeen: -1 });
userSchema.index({ "devices.deviceId": 1 });

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
