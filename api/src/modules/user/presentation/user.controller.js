/**
 * User Controller
 * HTTP request handlers for user operations
 */
export function createUserController(userService) {
  return {
    /**
     * Search users
     * GET /api/users/search?q=<query>&limit=<limit>
     */
    searchUsers: async (req, res) => {
      try {
        const { q, limit } = req.query;
        const currentUserId = req.user.id;

        const users = await userService.searchUsers(q, currentUserId, {
          limit: parseInt(limit) || 20,
        });

        res.json({
          success: true,
          data: users,
          message: "Users found",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get own profile
     * GET /api/users/me
     */
    getOwnProfile: async (req, res) => {
      try {
        const userId = req.user.id;
        const user = await userService.getUserProfile(userId);

        res.json({
          success: true,
          data: user,
          message: "Profile retrieved",
        });
      } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get user by ID
     * GET /api/users/:userId
     */
    getUserById: async (req, res) => {
      try {
        const { userId } = req.params;
        const user = await userService.getUserById(userId);

        res.json({
          success: true,
          data: user,
          message: "User retrieved successfully",
        });
      } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Block a user
     * POST /api/users/:userId/block
     */
    blockUser: async (req, res) => {
      try {
        const { userId } = req.params;
        const blockerId = req.user.id;

        const result = await userService.blockUser(blockerId, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Unblock a user
     * DELETE /api/users/:userId/block
     */
    unblockUser: async (req, res) => {
      try {
        const { userId } = req.params;
        const blockerId = req.user.id;

        const result = await userService.unblockUser(blockerId, userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Get blocked users list
     * GET /api/users/blocked/list
     */
    getBlockedUsers: async (req, res) => {
      try {
        const userId = req.user.id;
        const blockedUsers = await userService.getBlockedUsers(userId);

        res.json({
          success: true,
          data: blockedUsers,
          message: "Blocked users retrieved",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Check block status
     * GET /api/users/:userId/blocked/check
     */
    checkBlockStatus: async (req, res) => {
      try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        const result = await userService.isBlocked(currentUserId, userId);

        res.json({
          success: true,
          data: result,
          message: "Block status retrieved",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },
  };
}
