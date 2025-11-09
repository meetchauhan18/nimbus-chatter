import { authService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successResponse } from "../utils/response.js";


export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res
    .status(201)
    .json(successResponse(result, "User registered successfully", 201));
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.json(successResponse(result, "Login successful"));
});

export const refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);

  res.json(successResponse(result, "Token refreshed successfully"));
});

export const logout = asyncHandler(async (req, res) => {
  // In production, you'd invalidate the token in Redis
  res.json(successResponse(null, "Logout successful"));
});
