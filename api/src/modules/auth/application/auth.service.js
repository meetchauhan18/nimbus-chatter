import bcrypt from "bcrypt";
import { generateTokens, verifyRefreshToken } from "./jwt.utils.js";

/**
 * Auth Service - Business logic for authentication
 * Injected with dependencies via registry
 */
export class AuthService {
  constructor({ userRepository, logger, eventBus }) {
    this.userRepository = userRepository;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  /**
   * Register new user
   */
  async register({ email, username, password, displayName }) {
    // Check duplicates
    const [emailExists, usernameExists] = await Promise.all([
      this.userRepository.emailExists(email),
      this.userRepository.usernameExists(username),
    ]);

    if (emailExists) {
      throw new Error("Email already registered");
    }

    if (usernameExists) {
      throw new Error("Username already taken");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      displayName: displayName || username,
    });

    this.logger.info(`User registered: ${user.email}`);

    // Emit event for other modules (e.g., send welcome email)
    this.eventBus.emit("user.registered", {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    // Generate tokens
    const tokens = generateTokens(user._id.toString());

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    this.logger.info(`User logged in: ${user.email}`);

    // Emit event
    this.eventBus.emit("user.loggedIn", {
      userId: user._id.toString(),
      email: user.email,
    });

    // Generate tokens
    const tokens = generateTokens(user._id.toString());

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error("Refresh token required");
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error("Invalid refresh token");
    }

    // Verify user still exists
    const user = await this.userRepository.findById(decoded.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate new tokens
    const tokens = generateTokens(user._id.toString());

    return tokens;
  }

  /**
   * Logout (placeholder - token invalidation in Redis)
   */
  async logout(userId) {
    this.logger.info(`User logged out: ${userId}`);
    this.eventBus.emit("user.loggedOut", { userId });
    // TODO: Add token blacklist logic with Redis
  }
}

export default AuthService;
