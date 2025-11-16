import { UserRepository } from "./domain/user.repository.js";
import { UserService } from "./application/user.service.js";
import { createUserController } from "./presentation/user.controller.js";
import { createUserRoutes } from "./presentation/user.routes.js";
import { userValidator } from "./presentation/user.validator.js";

/**
 * User Module Definition
 * Handles user search, profile retrieval, and block/unblock
 */
export default {
  name: "user",
  version: "1.0.0",
  dependencies: [
    "core.logger",
    "core.eventBus",
    "core.cache",
    "auth.middleware",
  ],
  metadata: {
    description: "User search and blocking",
    routes: ["/api/users"],
  },

  register: (registry) => {
    // 1. Register Repository
    registry.registerService(
      "user.repository",
      () => {
        return new UserRepository();
      },
      { singleton: true, lazy: false }
    );

    // 2. Register Service
    registry.registerService(
      "user.service",
      async (reg) => {
        const userRepository = await reg.resolveAsync("user.repository");
        const cache = await reg.resolveAsync("core.cache");
        const eventBus = await reg.resolveAsync("core.eventBus");
        const logger = await reg.resolveAsync("core.logger");

        return new UserService({
          userRepository,
          cache,
          eventBus,
          logger,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: [
          "user.repository",
          "core.cache",
          "core.eventBus",
          "core.logger",
        ],
      }
    );

    // 3. Register Controller
    registry.registerService(
      "user.controller",
      async (reg) => {
        const userService = await reg.resolveAsync("user.service");
        return createUserController(userService);
      },
      {
        singleton: true,
        dependencies: ["user.service"],
      }
    );

    // 4. Register Routes
    registry.registerService(
      "user.routes",
      async (reg) => {
        const userController = await reg.resolveAsync("user.controller");
        const authMiddleware = await reg.resolveAsync("auth.middleware");

        // Import validate middleware
        const { validate } = await import("../../middleware/validate.js");

        return createUserRoutes(
          userController,
          authMiddleware,
          validate,
          userValidator
        );
      },
      {
        singleton: true,
        dependencies: ["user.controller", "auth.middleware"],
      }
    );
  },
};
