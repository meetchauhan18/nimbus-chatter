import { Router } from "express";

/**
 * Profile Routes
 * Defines HTTP endpoints for profile operations
 */
export function createProfileRoutes(
  profileController,
  authMiddleware,
  uploadMiddleware,
  validate,
  profileValidator
) {
  const router = Router();

  // ===== PROTECTED ROUTES =====

  /**
   * @route   GET /api/profile
   * @desc    Get user profile
   * @access  Private
   */
  router.get("/", authMiddleware, profileController.getProfile);

  /**
   * @route   PATCH /api/profile
   * @desc    Update profile
   * @access  Private
   */
  router.patch(
    "/",
    authMiddleware,
    validate(profileValidator.updateProfile),
    profileController.updateProfile
  );

  /**
   * @route   POST /api/profile/avatar
   * @desc    Upload avatar
   * @access  Private
   */
  router.post(
    "/avatar",
    authMiddleware,
    uploadMiddleware.single("avatar"), // Multer middleware
    profileController.uploadAvatar
  );

  /**
   * @route   DELETE /api/profile/avatar
   * @desc    Delete avatar
   * @access  Private
   */
  router.delete("/avatar", authMiddleware, profileController.deleteAvatar);

  /**
   * @route   POST /api/profile/change-password
   * @desc    Change password (authenticated)
   * @access  Private
   */
  router.post(
    "/change-password",
    authMiddleware,
    validate(profileValidator.changePassword),
    profileController.changePassword
  );

  /**
   * @route   PATCH /api/profile/privacy
   * @desc    Update privacy settings
   * @access  Private
   */
  router.patch(
    "/privacy",
    authMiddleware,
    validate(profileValidator.updatePrivacy),
    profileController.updatePrivacySettings
  );

  // ===== PUBLIC ROUTES (Password Reset) =====

  /**
   * @route   POST /api/profile/request-password-reset
   * @desc    Request password reset link
   * @access  Public
   */
  router.post(
    "/request-password-reset",
    validate(profileValidator.requestPasswordReset),
    profileController.requestPasswordReset
  );

  /**
   * @route   POST /api/profile/reset-password
   * @desc    Reset password using token
   * @access  Public
   */
  router.post(
    "/reset-password",
    validate(profileValidator.resetPassword),
    profileController.resetPassword
  );

  return router;
}
