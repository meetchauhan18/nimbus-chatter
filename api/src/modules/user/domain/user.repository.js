import User from "../../../models/user.js";

/**
 * User Repository
 * Data access layer for user operations
 */
export class UserRepository {
  constructor() {
    this.userModel = User;
  }

  /**
   * Find user by ID
   */
  async findById(userId, includePassword = false) {
    const query = this.userModel.findById(userId);

    if (!includePassword) {
      query.select("-password");
    }

    return query.exec();
  }

  /**
   * Search users by query
   */
  async searchUsers(query, excludeUserId, limit = 20) {
    return this.userModel
      .find({
        $and: [
          { _id: { $ne: excludeUserId } },
          {
            $or: [
              { email: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
              { displayName: { $regex: query, $options: "i" } },
            ],
          },
        ],
      })
      .select("username displayName avatar email status")
      .limit(limit)
      .exec();
  }

  /**
   * Get blocked users for a user
   */
  async getBlockedUsers(userId) {
    return this.userModel
      .findById(userId)
      .populate("blockedUsers.user", "displayName username avatar email")
      .select("blockedUsers")
      .exec();
  }

  /**
   * Check if userA has blocked userB
   */
  async isUserBlocked(userIdA, userIdB) {
    const user = await this.userModel.findById(userIdA);

    if (!user) return false;

    return user.hasBlocked(userIdB);
  }

  /**
   * Add user to blocked list
   */
  async blockUser(blockerId, blockedUserId) {
    const blocker = await this.userModel.findById(blockerId);

    if (!blocker) return null;

    blocker.blockUser(blockedUserId);
    await blocker.save();

    return blocker;
  }

  /**
   * Remove user from blocked list
   */
  async unblockUser(blockerId, blockedUserId) {
    const blocker = await this.userModel.findById(blockerId);

    if (!blocker) return null;

    blocker.unblockUser(blockedUserId);
    await blocker.save();

    return blocker;
  }

  /**
   * Check block status (static method from model)
   */
  async checkBlockStatus(userIdA, userIdB) {
    // Use the static method from User model
    const aBlockedB = await this.userModel.isBlockedBy(userIdA, userIdB);
    const bBlockedA = await this.userModel.isBlockedBy(userIdB, userIdA);

    return {
      aBlockedB,
      bBlockedA,
      isBlocked: aBlockedB || bBlockedA,
    };
  }
}
