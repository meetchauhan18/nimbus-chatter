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
    const users = await userService?.searchUsers(q, req.userId, {
      limit: parseInt(limit) || 20,
    });
    successResponse(res, users, "Users found");
  })
);

// Get own profile
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await userService?.getUserProfile(req.userId);
    successResponse(res, user, "Profile retrieved");
  })
);

export default router;
