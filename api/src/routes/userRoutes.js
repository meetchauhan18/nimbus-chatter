import express from "express";
import { verifyAccessToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { userService } from "../services/user.service.js";
import { successResponse } from "../utils/response.js";

const router = express.Router();

// All routes require authentication
router.use(verifyAccessToken);

// Search users
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query;
    const users = await userService.searchUsers(q, req.user.userId, {
      limit: parseInt(limit) || 20,
    });
    res.json(successResponse(users, "Users found"));
  })
);

// Get own profile
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await userService.getUserProfile(req.user.userId);
    res.json(successResponse(user, "Profile retrieved"));
  })
);

// ========== 🆕 BLOCK/UNBLOCK ROUTES ==========

// Get blocked users list (must be before /:userId to avoid conflict)
router.get(
  "/blocked/list",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const blockedUsers = await userService.getBlockedUsers(userId);
    res.json(successResponse(blockedUsers, "Blocked users retrieved"));
  })
);

// Get user by ID
router.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);
    res.json(successResponse(user, "User retrieved successfully"));
  })
);

// Block a user
router.post(
  "/:userId/block",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const blockerId = req.user.userId;

    console.log("🚀 ~ blockUser ~ userId:", userId);
    console.log("🚀 ~ blockUser ~ blockerId:", blockerId);

    const result = await userService.blockUser(blockerId, userId);
    res.json(successResponse(result, "User blocked successfully"));
  })
);

// Unblock a user
router.delete(
  "/:userId/block",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const blockerId = req.user.userId;

    console.log("🚀 ~ unblockUser ~ userId:", userId);

    const result = await userService.unblockUser(blockerId, userId);
    res.json(successResponse(result, "User unblocked successfully"));
  })
);

// Check block status
router.get(
  "/:userId/blocked/check",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    const result = await userService.isBlocked(currentUserId, userId);
    res.json(successResponse(result, "Block status retrieved"));
  })
);

export default router;
