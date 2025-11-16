import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { registerSchema, loginSchema } from "./auth.validator.js";

/**
 * Create auth routes with injected controller
 */
export const createAuthRoutes = (authController, authMiddleware) => {
  const router = Router();

  router.post("/register", validate(registerSchema), authController.register);
  router.post("/login", validate(loginSchema), authController.login);
  router.post("/refresh", authController.refreshToken);
  router.post("/logout", authMiddleware.verifyToken, authController.logout);

  return router;
};

export default createAuthRoutes;
