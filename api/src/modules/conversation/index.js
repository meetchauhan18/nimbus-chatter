import { ConversationRepository } from "./domain/conversation.repository.js";
import { ConversationService } from "./application/conversation.service.js";
import { GroupService } from "./application/group.service.js";
import { createConversationController } from "./presentation/conversation.controller.js";
import { createConversationRoutes } from "./presentation/conversation.routes.js";
import { conversationValidator } from "./presentation/conversation.validator.js";

/**
 * Conversation Module Definition
 * Handles conversations and group management
 */
export default {
  name: "conversation",
  version: "1.0.0",
  dependencies: [
    "core.logger",
    "core.eventBus",
    "core.cache",
    "auth.middleware",
  ],
  metadata: {
    description: "Conversation and group management",
    routes: ["/api/conversations"],
  },

  register: (registry) => {
    // 1. Register Repository
    registry.registerService(
      "conversation.repository",
      () => {
        return new ConversationRepository();
      },
      { singleton: true, lazy: false }
    );

    // 2. Register Conversation Service
    registry.registerService(
      "conversation.service",
      async (reg) => {
        const conversationRepository = await reg.resolveAsync(
          "conversation.repository"
        );
        const cache = await reg.resolveAsync("core.cache");
        const eventBus = await reg.resolveAsync("core.eventBus");
        const logger = await reg.resolveAsync("core.logger");

        return new ConversationService({
          conversationRepository,
          cache,
          eventBus,
          logger,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: [
          "conversation.repository",
          "core.cache",
          "core.eventBus",
          "core.logger",
        ],
      }
    );

    // 3. Register Group Service
    registry.registerService(
      "group.service",
      async (reg) => {
        const conversationRepository = await reg.resolveAsync(
          "conversation.repository"
        );
        const userRepository = await reg.resolveAsync("auth.repository"); // User repo from auth module
        const eventBus = await reg.resolveAsync("core.eventBus");
        const logger = await reg.resolveAsync("core.logger");

        return new GroupService({
          conversationRepository,
          userRepository,
          eventBus,
          logger,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: [
          "conversation.repository",
          "auth.repository",
          "core.eventBus",
          "core.logger",
        ],
      }
    );

    // 4. Register Controller
    registry.registerService(
      "conversation.controller",
      async (reg) => {
        const conversationService = await reg.resolveAsync(
          "conversation.service"
        );
        const groupService = await reg.resolveAsync("group.service");

        return createConversationController(conversationService, groupService);
      },
      {
        singleton: true,
        dependencies: ["conversation.service", "group.service"],
      }
    );

    // 5. Register Routes
    registry.registerService(
      "conversation.routes",
      async (reg) => {
        const conversationController = await reg.resolveAsync(
          "conversation.controller"
        );
        const authMiddleware = await reg.resolveAsync("auth.middleware");

        // Import validate middleware
        const { validate } = await import("../../middleware/validate.js");

        return createConversationRoutes(
          conversationController,
          authMiddleware,
          validate,
          conversationValidator
        );
      },
      {
        singleton: true,
        dependencies: ["conversation.controller", "auth.middleware"],
      }
    );
  },
};
