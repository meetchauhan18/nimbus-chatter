import { profileService } from "../services/profile.service.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { successResponse } from "../shared/utils/response.js";

export const getProfile = asyncHandler(async (req, res) => {
  const user = await profileService.getUserProfile(req.user?.userId);
  console.log("🚀 ~ user:", user)
  res.json(successResponse(user, "Profile retrieved successfully"));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await profileService.updateProfile(req.user.userId, req.body);
  res.json(successResponse(user, "Profile updated successfully"));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  console.log("🚀 ~ req:", req)
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const avatar = await profileService.uploadAvatar(req.user.userId, req.file);
  console.log("🚀 ~ avatar:", avatar)
  res.json(successResponse(avatar, "Avatar uploaded successfully"));
});

export const deleteAvatar = asyncHandler(async (req, res) => {
  const result = await profileService.deleteAvatar(req.user.userId);
  res.json(successResponse(result, "Avatar deleted successfully"));
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await profileService.changePassword(
    req.user.userId,
    currentPassword,
    newPassword
  );
  res.json(successResponse(result, "Password changed successfully"));
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await profileService.requestPasswordReset(email);
  res.json(successResponse(result));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await profileService.resetPassword(token, newPassword);
  res.json(successResponse(result));
});

export const updatePrivacySettings = asyncHandler(async (req, res) => {
  const privacy = await profileService.updatePrivacySettings(
    req.user.userId,
    req.body
  );
  res.json(successResponse(privacy, "Privacy settings updated"));
});
