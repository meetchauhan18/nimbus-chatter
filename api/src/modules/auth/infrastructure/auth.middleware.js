import { verifyAccessToken } from "../application/jwt.utils.js";

/**
 * Create auth middleware with injected repository
 */
export const createAuthMiddleware = (userRepository) => ({
  /**
   * Verify JWT token
   */
  verifyToken: async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }

      const decoded = verifyAccessToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      // Verify user exists
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach user info to request
      req.user = {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
      };

      next();
    } catch (error) {
      return res.status(401).json({ message: "Authentication failed" });
    }
  },
});

export default createAuthMiddleware;
