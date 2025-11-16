/**
 * Core Infrastructure Module
 * Wraps existing Database, RedisManager, EventBus, Logger, Cache
 */
export default {
  name: "core",
  version: "1.0.0",
  dependencies: [],
  metadata: {
    description: "Core infrastructure services",
  },

  register: (registry) => {
    // Config (async import)
    registry.registerService(
      "core.config",
      async () => {
        const { config } = await import("../../shared/config/index.js");
        return config;
      },
      { singleton: true, lazy: false }
    );

    // Logger (depends on config)
    registry.registerService(
      "core.logger",
      async (reg) => {
        const config = await reg.resolveAsync("core.config");
        const Logger = await import("../../shared/logger/index.js");
        return new Logger.default(config.env, config.logLevel);
      },
      { singleton: true, lazy: false, dependencies: ["core.config"] }
    );

    // Database (depends on logger)
    registry.registerService(
      "core.database",
      async (reg) => {
        const logger = await reg.resolveAsync("core.logger");
        const Database = await import("../../shared/database/index.js");
        return new Database.default(logger);
      },
      {
        singleton: true,
        lazy: false,
        dependencies: ["core.config", "core.logger"],
      }
    );

    // Redis Manager (depends on config, logger)
    registry.registerService(
      "core.redis",
      async (reg) => {
        const config = await reg.resolveAsync("core.config");
        const logger = await reg.resolveAsync("core.logger");
        const RedisManager = await import("../../shared/redis/index.js");

        const manager = new RedisManager.default({
          config: config.redis,
          logger,
        });

        await manager.connect();

        return manager;
      },
      {
        singleton: true,
        lazy: false,
        dependencies: ["core.config", "core.logger"],
      }
    );

    // EventBus (depends on redis, logger)
    registry.registerService(
      "core.eventBus",
      async (reg) => {
        const redis = await reg.resolveAsync("core.redis");
        const logger = await reg.resolveAsync("core.logger");
        const EventBus = await import("../../shared/events/EventBus.js");

        if (!redis.pubClient || !redis.subClient) {
          throw new Error("Redis clients not initialized properly");
        }

        return new EventBus.default({
          pubClient: redis.pubClient,
          subClient: redis.subClient,
          logger: logger,
        });
      },
      {
        singleton: true,
        lazy: false,
        dependencies: ["core.redis", "core.logger"],
      }
    );

    // Cache Service (depends on redis)
    registry.registerService(
      "core.cache",
      async (reg) => {
        const redis = await reg.resolveAsync("core.redis");
        const CacheService = await import("../../services/cache.service.js");
        return new CacheService.default(redis.cacheClient);
      },
      { singleton: true, lazy: false, dependencies: ["core.redis"] }
    );

    // Redis Service (depends on redis)
    registry.registerService(
      "core.redisService",
      async (reg) => {
        const redis = await reg.resolveAsync("core.redis");
        const RedisService = await import("../../services/redisServices.js");
        return new RedisService.default(redis.cacheClient);
      },
      { singleton: true, lazy: false, dependencies: ["core.redis"] }
    );

    registry.registerService(
      "conversation.service",
      async () => {
        const { ConversationServiceStub } = await import(
          "../../services/conversation.service.stub.js"
        );
        return new ConversationServiceStub();
      },
      { singleton: true, lazy: false }
    );
  },

  init: async (registry) => {
    const logger = await registry.resolveAsync("core.logger");
    const database = await registry.resolveAsync("core.database");
    const eventBus = await registry.resolveAsync("core.eventBus");

    logger.info("🚀 Initializing core infrastructure...");

    // Connect database
    await database.connect();

    // Redis already connected during service creation
    logger.info("✅ Redis clients ready");

    // Start EventBus listening
    if (eventBus.startListening) {
      eventBus.startListening();
    }

    logger.info("✅ Core infrastructure initialized");
  },

  destroy: async (registry) => {
    const logger = await registry.resolveAsync("core.logger");
    const database = await registry.resolveAsync("core.database");
    const redis = await registry.resolveAsync("core.redis");
    const eventBus = await registry.resolveAsync("core.eventBus");

    logger.info("🛑 Shutting down core infrastructure...");

    if (eventBus.stopListening) {
      eventBus.stopListening();
    }

    if (database.disconnect) {
      await database.disconnect();
    }

    if (redis.disconnect) {
      await redis.disconnect();
    }
  },
};
