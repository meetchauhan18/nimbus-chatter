import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../config/jwt.js";
import User from "../models/user.js";
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
} from "../utils/AppError.js";

/**
 * Authentication Service
 * Handles all authentication business logic
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register({ phone, displayName, password, username }) {
    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new ConflictError("Phone number already registered");
    }

    // Check username uniqueness if provided
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        throw new ConflictError("Username already taken");
      }
    }

    // Create user
    const user = await User.create({
      phone,
      displayName,
      password,
      username,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.phone);
    const refreshToken = generateRefreshToken(user._id);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login existing user
   */
  async login({ phone, password }) {
    // Find user and explicitly include password field
    const user = await User.findOne({ phone }).select("+password");

    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.phone);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastSeen = new Date();
    await user.save();

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id, user.phone);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Remove sensitive fields from user object
   */
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;

    return {
      id: userObj._id,
      phone: userObj.phone,
      displayName: userObj.displayName,
      username: userObj.username,
      avatar: userObj.avatar,
      status: userObj.status,
      about: userObj.about,
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
