import express from "express";
import {
  register,
  login,
  refreshToken,
  logout,
} from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";
import { verifyAccessToken } from "../middleware/auth.js";
import { inspectToken, checkServerTime } from "../utils/verifyToken.js";

const router = express.Router();

// Public routes with validation
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refreshToken);

// Debug endpoints (remove in production)
if (process.env.NODE_ENV === 'development') {
  router.post("/debug/inspect-token", (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    const info = inspectToken(token);
    res.json(info);
  });

  router.get("/debug/server-time", (req, res) => {
    checkServerTime();
    res.json({
      serverTime: new Date().toISOString(),
      unixTimestamp: Math.floor(Date.now() / 1000)
    });
  });
}

// Protected routes
router.post("/logout", verifyAccessToken, logout);

export default router;
