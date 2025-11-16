import { Router } from "express";

/**
 * User Routes
 * Defines HTTP endpoints for user operations
 */
export function createUserRoutes(
  userController,
  authMiddleware,
  validate,
  userValidator
) {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  /**
   * @route   GET /api/users/search
   * @desc    Search users
   * @access  Private
   */
  router.get(
    "/search",
    validate(userValidator.searchUsers),
    userController.searchUsers
  );

  /**
   * @route   GET /api/users/me
   * @desc    Get own profile
   * @access  Private
   */
  router.get("/me", userController.getOwnProfile);

  /**
   * @route   GET /api/users/blocked/list
   * @desc    Get blocked users list (must be before /:userId)
   * @access  Private
   */
  router.get("/blocked/list", userController.getBlockedUsers);

  /**
   * @route   GET /api/users/:userId
   * @desc    Get user by ID
   * @access  Private
   */
  router.get(
    "/:userId",
    validate(userValidator.getUserById),
    userController.getUserById
  );

  /**
   * @route   POST /api/users/:userId/block
   * @desc    Block a user
   * @access  Private
   */
  router.post(
    "/:userId/block",
    validate(userValidator.blockUser),
    userController.blockUser
  );

  /**
   * @route   DELETE /api/users/:userId/block
   * @desc    Unblock a user
   * @access  Private
   */
  router.delete(
    "/:userId/block",
    validate(userValidator.unblockUser),
    userController.unblockUser
  );

  /**
   * @route   GET /api/users/:userId/blocked/check
   * @desc    Check block status
   * @access  Private
   */
  router.get(
    "/:userId/blocked/check",
    validate(userValidator.checkBlockStatus),
    userController.checkBlockStatus
  );

  return router;
}
