import express from "express";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  requestPasswordReset,
  resetPassword,
  updatePrivacySettings,
} from "../controllers/profileController.js";
import { verifyAccessToken } from "../middleware/auth.js";
import { upload } from "../config/cloudinary.js";
import { validate } from "../middleware/validate.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "../validators/profile.validator.js";

const router = express.Router();

// Protected routes
router.get("/", verifyAccessToken, getProfile);
router.patch(
  "/",
  verifyAccessToken,
  validate(updateProfileSchema),
  updateProfile
);
router.post(
  "/avatar",
  verifyAccessToken,
  (req, res, next) => {
    console.log("➡️ Multer upload called for avatar upload");
    next();
  },
  upload.single("avatar"),
  (req, res, next) => {
    console.log("✅ File received by multer:", req.file?.originalname);
    console.log("📦 File details:", req.file);
    next();
  },
  uploadAvatar
);
router.delete("/avatar", verifyAccessToken, deleteAvatar);
router.post(
  "/change-password",
  verifyAccessToken,
  validate(changePasswordSchema),
  changePassword
);
router.patch("/privacy", verifyAccessToken, updatePrivacySettings);

// Public routes (password reset)
router.post(
  "/request-password-reset",
  validate(requestPasswordResetSchema),
  requestPasswordReset
);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
