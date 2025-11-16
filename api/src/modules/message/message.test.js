import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { MessageService } from "./application/message.service.js";

describe("Message Module", () => {
  let messageService;
  let mockRepository;
  let mockConversationService;
  let mockCache;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      create: async (data) => ({ _id: "msg123", ...data }),
      findById: async (id) => ({ _id: id, sender: "user1" }),
      findByConversation: async () => ({ messages: [], pagination: {} }),
    };

    mockConversationService = {
      getById: async () => ({ _id: "conv1", participants: ["user1", "user2"] }),
      updateLastMessage: async () => {},
    };

    mockCache = {
      get: async () => null,
      setex: async () => {},
      del: async () => {},
    };

    mockEventBus = {
      emit: () => {},
    };

    mockLogger = {
      info: () => {},
      debug: () => {},
    };

    mockDeliveryQueue = {
      add: async () => {},
    };

    messageService = new MessageService({
      messageRepository: mockRepository,
      conversationService: mockConversationService,
      cache: mockCache,
      eventBus: mockEventBus,
      logger: mockLogger,
      deliveryQueue: mockDeliveryQueue,
    });
  });

  it("should send a message successfully", async () => {
    const result = await messageService.sendMessage({
      senderId: "user1",
      conversationId: "conv1",
      content: "Hello world",
      type: "text",
    });

    assert.strictEqual(result._id, "msg123");
  });

  it("should reject message from non-participant", async () => {
    await assert.rejects(
      messageService.sendMessage({
        senderId: "user3", // Not in conversation
        conversationId: "conv1",
        content: "Hello",
        type: "text",
      }),
      { message: "User is not a participant in this conversation" }
    );
  });
});
