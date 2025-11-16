import User from "../models/user.js";
import { NotFoundError, BadRequestError } from "../utils/AppError.js";

export class UserService {
  /**
   * Search users by phone, displayName, or username
   */
  async searchUsers(query, currentUserId, options = {}) {
    const { limit = 20 } = options;
    if (!query || query.trim().length < 2) {
      return [];
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
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
      .limit(limit);

    return users;
  }

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
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  /**
   * Block a user
   */
  async blockUser(blockerId, blockedUserId) {
    if (blockerId === blockedUserId) {
      throw new BadRequestError("You cannot block yourself");
    }

    const blocker = await User.findById(blockerId);
    const blockedUser = await User.findById(blockedUserId);

    if (!blocker || !blockedUser) {
      throw new NotFoundError("User not found");
    }

    // Add to blocked list using model method
    blocker.blockUser(blockedUserId);
    await blocker.save();

    return {
      message: "User blocked successfully",
      blockedUser: {
        _id: blockedUser._id,
        username: blockedUser.username,
        displayName: blockedUser.displayName,
      },
    };
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId, blockedUserId) {
    const blocker = await User.findById(blockerId);

    if (!blocker) {
      throw new NotFoundError("User not found");
    }

    if (!blocker.hasBlocked(blockedUserId)) {
      throw new BadRequestError("User is not blocked");
    }

    blocker.unblockUser(blockedUserId);
    await blocker.save();

    return {
      message: "User unblocked successfully",
    };
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(userId) {
    const user = await User.findById(userId)
      .populate("blockedUsers.user", "displayName username avatar email")
      .select("blockedUsers");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user.blockedUsers;
  }

  /**
   * Check if user A has blocked user B (or vice versa)
   */
  async isBlocked(userIdA, userIdB) {
    // Check both directions
    const aBlockedB = await User.isBlockedBy(userIdA, userIdB);
    const bBlockedA = await User.isBlockedBy(userIdB, userIdA);

    return {
      aBlockedB,
      bBlockedA,
      isBlocked: aBlockedB || bBlockedA,
    };
  }
}

export const userService = new UserService();
