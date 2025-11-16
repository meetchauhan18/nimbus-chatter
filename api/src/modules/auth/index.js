import { UserRepository } from "./domain/User.repository.js";
import { AuthService } from "./application/auth.service.js";
import { createAuthController } from "./presentation/auth.controller.js";
import { createAuthRoutes } from "./presentation/auth.routes.js";
import { createAuthMiddleware } from "./infrastructure/auth.middleware.js";

/**
 * Auth Module Definition
 * FIXED: Removed redundant dependencies to prevent circular resolution
 */
export default {
  name: "auth",
  version: "1.0.0",
  dependencies: ["core.logger", "core.eventBus"],
  metadata: {
    description: "Authentication and authorization",
    routes: ["/api/auth"],
  },

  register: (registry) => {
    // Register repository (no dependencies)
    registry.registerService(
      "auth.repository",
      () => {
        return new UserRepository();
      },
      { singleton: true, lazy: false } // Eager load to prevent circular
    );

    // Register service (depends on repository + core services)
    registry.registerService(
      "auth.service",
      async (reg) => {
        const userRepository = await reg.resolveAsync("auth.repository");
        const logger = await reg.resolveAsync("core.logger");
        const eventBus = await reg.resolveAsync("core.eventBus");

        return new AuthService({
          userRepository,
          logger,
          eventBus,
        });
      },
      {
        singleton: true,
        dependencies: ["auth.repository", "core.logger", "core.eventBus"],
      }
    );

    // Register controller (depends on service only)
    registry.registerService(
      "auth.controller",
      async (reg) => {
        const authService = await reg.resolveAsync("auth.service");
        return createAuthController(authService);
      },
      { singleton: true, dependencies: ["auth.service"] }
    );

    // Register middleware (depends on repository only - NO dependencies declared)
    // Repository is already eagerly loaded as singleton
    registry.registerService(
      "auth.middleware",
      async (reg) => {
        const userRepository = await reg.resolveAsync("auth.repository");
        return createAuthMiddleware(userRepository);
      },
      { singleton: true } // No dependencies declared - resolves directly
    );

    // Register routes (depends on controller + middleware)
    registry.registerService(
      "auth.routes",
      async (reg) => {
        const authController = await reg.resolveAsync("auth.controller");
        const authMiddleware = await reg.resolveAsync("auth.middleware");
        return createAuthRoutes(authController, authMiddleware);
      },
      { singleton: true, dependencies: ["auth.controller", "auth.middleware"] }
    );
  },

  init: async (registry) => {
    const logger = await registry.resolveAsync("core.logger");
    logger.info("✅ Auth module initialized");
  },
};
