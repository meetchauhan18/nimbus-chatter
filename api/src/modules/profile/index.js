import { ProfileRepository } from "./domain/profile.repository.js";
import { ProfileService } from "./application/profile.service.js";
import { CloudinaryService } from "./infrastructure/cloudinary.service.js";
import { createProfileController } from "./presentation/profile.controller.js";
import { createProfileRoutes } from "./presentation/profile.routes.js";
import { profileValidator } from "./presentation/profile.validator.js";

/**
 * Profile Module Definition
 * Handles user profile management, avatars, passwords, and privacy
 */
export default {
  name: "profile",
  version: "1.0.0",
  dependencies: [
    "core.logger",
    "core.eventBus",
    "auth.middleware",
    "email.service", // From core or separate email module
  ],
  metadata: {
    description: "User profile management",
    routes: ["/api/profile"],
  },

  register: (registry) => {
    // 1. Register Cloudinary Service
    registry.registerService(
      "profile.cloudinaryService",
      () => {
        return new CloudinaryService();
      },
      { singleton: true, lazy: false }
    );

    // 2. Register Repository
    registry.registerService(
      "profile.repository",
      () => {
        return new ProfileRepository();
      },
      { singleton: true, lazy: false }
    );

    // 3. Register Service
    registry.registerService(
      "profile.service",
      async (reg) => {
        const profileRepository = await reg.resolveAsync("profile.repository");
        const cloudinaryService = await reg.resolveAsync(
          "profile.cloudinaryService"
        );
        const logger = await reg.resolveAsync("core.logger");
        const eventBus = await reg.resolveAsync("core.eventBus");

        // Email service - import legacy for now
        const { emailService } = await import(
          "../../services/email.service.js"
        );

        return new ProfileService({
          profileRepository,
          cloudinaryService,
          emailService,
          logger,
          eventBus,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: [
          "profile.repository",
          "profile.cloudinaryService",
          "core.logger",
          "core.eventBus",
        ],
      }
    );

    // 4. Register Controller
    registry.registerService(
      "profile.controller",
      async (reg) => {
        const profileService = await reg.resolveAsync("profile.service");
        return createProfileController(profileService);
      },
      {
        singleton: true,
        dependencies: ["profile.service"],
      }
    );

    // 5. Register Routes
    registry.registerService(
      "profile.routes",
      async (reg) => {
        const profileController = await reg.resolveAsync("profile.controller");
        const authMiddleware = await reg.resolveAsync("auth.middleware");

        // Import Cloudinary upload middleware
        const { uploadAvatar } = await import("../../config/cloudinary.js");

        // Import validate middleware
        const { validate } = await import("../../middleware/validate.js");

        return createProfileRoutes(
          profileController,
          authMiddleware,
          uploadAvatar, // Multer middleware for file upload
          validate,
          profileValidator
        );
      },
      {
        singleton: true,
        dependencies: ["profile.controller", "auth.middleware"],
      }
    );
  },
};
