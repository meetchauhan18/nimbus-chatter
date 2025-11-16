import crypto from "crypto";

/**
 * Profile Service
 * Business logic for profile management
 */
export class ProfileService {
  constructor({
    profileRepository,
    cloudinaryService,
    emailService,
    logger,
    eventBus,
  }) {
    this.profileRepository = profileRepository;
    this.cloudinaryService = cloudinaryService;
    this.emailService = emailService;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const user = await this.profileRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    this.logger.debug("Profile retrieved", { userId });
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
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
      const existingUser = await this.profileRepository.findByUsername(
        actualUpdates.username,
        userId
      );

      if (existingUser) {
        throw new Error("Username already taken");
      }
    }

    const user = await this.profileRepository.update(userId, actualUpdates);

    if (!user) {
      throw new Error("User not found");
    }

    // Emit event
    this.eventBus.emit("profile.updated", {
      userId: userId.toString(),
      updates: actualUpdates,
    });

    this.logger.info("Profile updated", { userId, updates: actualUpdates });
    return user;
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(userId, file) {
    if (!file) {
      throw new Error("No file provided");
    }

    const user = await this.profileRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar?.publicId) {
      try {
        await this.cloudinaryService.deleteImage(user.avatar.publicId);
        this.logger.debug("Old avatar deleted", {
          publicId: user.avatar.publicId,
        });
      } catch (error) {
        this.logger.error("Error deleting old avatar", {
          error: error.message,
        });
      }
    }

    // Update user avatar (Multer/Cloudinary already uploaded the file)
    const avatarData = {
      url: file.path,
      publicId: file.filename,
    };

    const updatedUser = await this.profileRepository.updateAvatar(
      userId,
      avatarData
    );

    // Emit event
    this.eventBus.emit("profile.avatar.updated", {
      userId: userId.toString(),
      avatarUrl: avatarData.url,
    });

    this.logger.info("Avatar uploaded", {
      userId,
      publicId: avatarData.publicId,
    });
    return updatedUser.avatar;
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(userId) {
    const user = await this.profileRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Delete from Cloudinary
    if (user.avatar?.publicId) {
      try {
        await this.cloudinaryService.deleteImage(user.avatar.publicId);
        this.logger.debug("Avatar deleted from Cloudinary", {
          publicId: user.avatar.publicId,
        });
      } catch (error) {
        this.logger.error("Error deleting avatar from Cloudinary", {
          error: error.message,
        });
      }
    }

    // Reset avatar to null
    await this.profileRepository.deleteAvatar(userId);

    // Emit event
    this.eventBus.emit("profile.avatar.deleted", {
      userId: userId.toString(),
    });

    this.logger.info("Avatar deleted", { userId });
    return { message: "Avatar deleted successfully" };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.profileRepository.findById(userId, true); // Include password

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    await this.profileRepository.updatePassword(userId, newPassword);

    // Emit event
    this.eventBus.emit("profile.password.changed", {
      userId: userId.toString(),
    });

    this.logger.info("Password changed", { userId });
    return { message: "Password changed successfully" };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await this.profileRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists for security
      this.logger.warn("Password reset requested for non-existent email", {
        email,
      });
      return { message: "If the email exists, a reset link has been sent" };
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token expiration (1 hour)
    const expires = Date.now() + 3600000;

    await this.profileRepository.setResetToken(user._id, hashedToken, expires);

    // Send email
    try {
      await this.emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.username
      );

      // Emit event
      this.eventBus.emit("profile.password.reset.requested", {
        userId: user._id.toString(),
        email,
      });

      this.logger.info("Password reset email sent", {
        userId: user._id,
        email,
      });
      return { message: "Password reset link sent to your email" };
    } catch (error) {
      // Rollback token if email fails
      await this.profileRepository.clearResetToken(user._id);

      this.logger.error("Failed to send password reset email", {
        error: error.message,
        userId: user._id,
      });
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
    const user = await this.profileRepository.findByResetToken(hashedToken);

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    // Update password
    await this.profileRepository.updatePassword(user._id, newPassword);

    // Clear reset token
    await this.profileRepository.clearResetToken(user._id);

    // Emit event
    this.eventBus.emit("profile.password.reset.completed", {
      userId: user._id.toString(),
    });

    this.logger.info("Password reset completed", { userId: user._id });
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

    if (Object.keys(updates).length === 0) {
      throw new Error("No valid privacy settings provided");
    }

    const user = await this.profileRepository.updatePrivacySettings(
      userId,
      updates
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Emit event
    this.eventBus.emit("profile.privacy.updated", {
      userId: userId.toString(),
      settings: updates,
    });

    this.logger.info("Privacy settings updated", { userId, settings: updates });
    return user.privacy;
  }
}
