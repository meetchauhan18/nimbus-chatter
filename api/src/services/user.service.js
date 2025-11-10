import User from "../models/user.js";

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
}

export const userService = new UserService();
