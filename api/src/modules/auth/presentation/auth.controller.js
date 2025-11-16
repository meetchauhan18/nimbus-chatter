import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { successResponse } from "../../../shared/utils/response.js";

/**
 * Auth Controller Factory
 * Creates controller with injected auth service
 */
export const createAuthController = (authService) => ({
  /**
   * Register new user
   */
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res
      .status(201)
      .json(successResponse(result, "User registered successfully", 201));
  }),

  /**
   * Login user
   */
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(successResponse(result, "Login successful"));
  }),

  /**
   * Refresh access token
   */
  refreshToken: asyncHandler(async (req, res) => {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(successResponse(result, "Token refreshed successfully"));
  }),

  /**
   * Logout user
   */
  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.user.userId);
    res.json(successResponse(null, "Logout successful"));
  }),
});

export default createAuthController;
