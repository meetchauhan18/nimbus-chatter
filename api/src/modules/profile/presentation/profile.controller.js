/**
 * Profile Controller
 * HTTP request handlers for profile operations
 */
export function createProfileController(profileService) {
  return {
    /**
     * Get user profile
     * GET /api/profile
     */
    getProfile: async (req, res) => {
      try {
        const user = await profileService.getUserProfile(req.user.id);

        res.json({
          success: true,
          data: user,
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
     * Update profile
     * PATCH /api/profile
     */
    updateProfile: async (req, res) => {
      try {
        const user = await profileService.updateProfile(req.user.id, req.body);

        res.json({
          success: true,
          data: user,
          message: "Profile updated successfully",
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
     * Upload avatar
     * POST /api/profile/avatar
     */
    uploadAvatar: async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "No file uploaded",
          });
        }

        const avatar = await profileService.uploadAvatar(req.user.id, req.file);

        res.json({
          success: true,
          data: avatar,
          message: "Avatar uploaded successfully",
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Delete avatar
     * DELETE /api/profile/avatar
     */
    deleteAvatar: async (req, res) => {
      try {
        const result = await profileService.deleteAvatar(req.user.id);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Change password
     * POST /api/profile/change-password
     */
    changePassword: async (req, res) => {
      try {
        const { currentPassword, newPassword } = req.body;

        const result = await profileService.changePassword(
          req.user.id,
          currentPassword,
          newPassword
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("incorrect") ? 401 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Request password reset
     * POST /api/profile/request-password-reset
     */
    requestPasswordReset: async (req, res) => {
      try {
        const { email } = req.body;

        const result = await profileService.requestPasswordReset(email);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Reset password
     * POST /api/profile/reset-password
     */
    resetPassword: async (req, res) => {
      try {
        const { token, newPassword } = req.body;

        const result = await profileService.resetPassword(token, newPassword);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const statusCode = error.message.includes("Invalid") ? 400 : 400;
        res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * Update privacy settings
     * PATCH /api/profile/privacy
     */
    updatePrivacySettings: async (req, res) => {
      try {
        const privacy = await profileService.updatePrivacySettings(
          req.user.id,
          req.body
        );

        res.json({
          success: true,
          data: privacy,
          message: "Privacy settings updated",
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
