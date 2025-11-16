import { MessageRepository } from "./infrastructure/Message.repository.js";
import { MessageService } from "./application/message.service.js";
import { createMessageController } from "./presentation/message.controller.js";
import { createMessageRoutes } from "./presentation/message.routes.js";
import { messageValidator } from "./presentation/message.validator.js";

/**
 * Message Module Definition
 * Registers all message-related services with the registry
 */
export default {
  name: "message",
  version: "1.0.0",
  dependencies: [
    "core.logger",
    "core.eventBus",
    "core.cache",
    "auth.middleware", // For route protection
    "conversation.service", // For verifying conversation access, etc.
  ],
  metadata: {
    description: "Message management and delivery",
    routes: ["/api/messages"],
  },

  register: (registry) => {
    // 1. Register Repository (no dependencies)
    registry.registerService(
      "message.repository",
      () => {
        return new MessageRepository();
      },
      { singleton: true, lazy: false }
    );

    // 2. Register Service (depends on repository + core services + conversation service)
    registry.registerService(
      "message.service",
      async (reg) => {
        const messageRepository = await reg.resolveAsync("message.repository");
        const conversationService = await reg.resolveAsync(
          "conversation.service"
        );
        const cache = await reg.resolveAsync("core.cache");
        const eventBus = await reg.resolveAsync("core.eventBus");
        const logger = await reg.resolveAsync("core.logger");

        // Delivery queue - import legacy for now
        const { messageDeliveryQueue } = await import(
          "../../queues/messageDeliveryQueue.js"
        );

        return new MessageService({
          messageRepository,
          conversationService,
          cache,
          eventBus,
          logger,
          deliveryQueue: messageDeliveryQueue,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: [
          "message.repository",
          "conversation.service",
          "core.cache",
          "core.eventBus",
          "core.logger",
        ],
      }
    );

    // 3. Register Controller
    registry.registerService(
      "message.controller",
      async (reg) => {
        const messageService = await reg.resolveAsync("message.service");
        return createMessageController(messageService);
      },
      {
        singleton: true,
        dependencies: ["message.service"],
      }
    );

    // 4. Register Routes
    registry.registerService(
      "message.routes",
      async (reg) => {
        const messageController = await reg.resolveAsync("message.controller");
        const authMiddleware = await reg.resolveAsync("auth.middleware");

        // Import validate middleware
        const { validate } = await import("../../middleware/validate.js");

        return createMessageRoutes(
          messageController,
          authMiddleware,
          validate,
          messageValidator
        );
      },
      {
        singleton: true,
        dependencies: ["message.controller", "auth.middleware"],
      }
    );
  },
};
