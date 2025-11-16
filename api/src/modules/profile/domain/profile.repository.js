import User from "../../../models/user.js";

/**
 * Profile Repository
 * Data access layer for profile operations
 */
export class ProfileRepository {
  constructor() {
    this.userModel = User;
  }

  /**
   * Find user by ID (exclude password by default)
   */
  async findById(userId, includePassword = false) {
    const query = this.userModel.findById(userId);

    if (!includePassword) {
      query.select("-password");
    } else {
      query.select("+password");
    }

    return query.exec();
  }

  /**
   * Update user profile
   */
  async update(userId, updates) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      )
      .select("-password");
  }

  /**
   * Update avatar
   */
  async updateAvatar(userId, avatarData) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { avatar: avatarData } },
        { new: true }
      )
      .select("-password");
  }

  /**
   * Delete avatar (set to null)
   */
  async deleteAvatar(userId) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { avatar: { url: null, publicId: null } } },
        { new: true }
      )
      .select("-password");
  }

  /**
   * Update password
   */
  async updatePassword(userId, newPassword) {
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    return user;
  }

  /**
   * Find user by email (for password reset)
   */
  async findByEmail(email) {
    return this.userModel.findOne({ email });
  }

  /**
   * Find user by username (for uniqueness check)
   */
  async findByUsername(username, excludeUserId = null) {
    const query = { username };

    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    return this.userModel.findOne(query);
  }

  /**
   * Find user by reset token
   */
  async findByResetToken(hashedToken) {
    return this.userModel
      .findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      })
      .select("+passwordResetToken +passwordResetExpires");
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(userId, privacyUpdates) {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: privacyUpdates }, { new: true })
      .select("-password");
  }

  /**
   * Set password reset token
   */
  async setResetToken(userId, token, expires) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
      { new: true }
    );
  }

  /**
   * Clear password reset token
   */
  async clearResetToken(userId) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $unset: {
          passwordResetToken: 1,
          passwordResetExpires: 1,
        },
      },
      { new: true }
    );
  }
}
