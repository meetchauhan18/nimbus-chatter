import User from "../../../models/user.js";

/**
 * User Repository - Data access abstraction for Auth module
 * Only exposes auth-relevant operations
 */
export class UserRepository {
  constructor() {
    this.model = User;
  }

  /**
   * Find user by email (auth)
   */
  async findByEmail(email) {
    return this.model.findOne({ email }).select("+password");
  }

  /**
   * Find user by ID (auth context)
   */
  async findById(userId) {
    return this.model.findById(userId).select("+password");
  }

  /**
   * Create new user (registration)
   */
  async create(userData) {
    const user = new this.model(userData);
    await user.save();
    return user;
  }

  /**
   * Check if email exists
   */
  async emailExists(email) {
    const count = await this.model.countDocuments({ email });
    return count > 0;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username) {
    const count = await this.model.countDocuments({ username });
    return count > 0;
  }

  /**
   * Update user password
   */
  async updatePassword(userId, hashedPassword) {
    return this.model.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    );
  }

  /**
   * Store password reset token
   */
  async storeResetToken(userId, token, expiry) {
    return this.model.findByIdAndUpdate(userId, {
      resetPasswordToken: token,
      resetPasswordExpires: expiry,
    });
  }

  /**
   * Find user by reset token
   */
  async findByResetToken(token) {
    return this.model.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
  }

  /**
   * Clear reset token
   */
  async clearResetToken(userId) {
    return this.model.findByIdAndUpdate(userId, {
      $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
    });
  }
}

export default UserRepository;
