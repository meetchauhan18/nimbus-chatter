import User from "../models/user.js";
import cloudinary from "../config/cloudinary.js";
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from "../utils/AppError.js";
import { emailService } from "./email.service.js";
import crypto from "crypto";

export class ProfileService {
  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId).select("-password");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    console.log("🚀 ~ ProfileService ~ updateProfile ~ userId:", userId)
    const allowedUpdates = ["displayName", "about", "username"];
    const actualUpdates = {};

    // Filter only allowed fields
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        actualUpdates[key] = updates[key];
      }
    });

    // Check username uniqueness if updating username
    if (actualUpdates.username) {
      const existingUser = await User.findOne({
        username: actualUpdates.username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new BadRequestError("Username already taken");
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: actualUpdates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(userId, file) {
    console.log("🚀 ~ ProfileService ~ uploadAvatar ~ file:", file)
    console.log("🚀 ~ ProfileService ~ uploadAvatar ~ userId:", userId)
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar.publicId) {
      try {
        await cloudinary.uploader.destroy(user.avatar.publicId);
      } catch (error) {
        console.error("Error deleting old avatar:", error);
      }
    }

    // Update user avatar
    user.avatar = {
      url: file.path,
      publicId: file.filename,
    };

    await user.save();

    return user.avatar;
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Delete from Cloudinary
    if (user.avatar.publicId) {
      try {
        await cloudinary.uploader.destroy(user.avatar.publicId);
      } catch (error) {
        console.error("Error deleting avatar:", error);
      }
    }

    // Reset avatar to default
    user.avatar = {
      url: null,
      publicId: null,
    };

    await user.save();

    return { message: "Avatar deleted successfully" };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return { message: "Password changed successfully" };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists for security
      return { message: "If the email exists, a reset link has been sent" };
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    try {
      await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.username
      );
      return { message: "Password reset link sent to your email" };
    } catch (error) {
      // Rollback token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      throw new Error("Failed to send password reset email");
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(token, newPassword) {
    // Hash token to match stored version
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: "Password reset successful" };
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(userId, settings) {
    const allowedSettings = ["lastSeen", "profilePhoto", "about"];
    const allowedValues = ["everyone", "contacts", "nobody"];

    const updates = {};
    Object.keys(settings).forEach((key) => {
      if (
        allowedSettings.includes(key) &&
        allowedValues.includes(settings[key])
      ) {
        updates[`privacy.${key}`] = settings[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user.privacy;
  }
}

export const profileService = new ProfileService();
