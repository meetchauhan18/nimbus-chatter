/**
 * Core Infrastructure Module
 * Wraps existing Database, RedisManager, EventBus, Logger
 */
export default {
  name: "core",
  version: "1.0.0",
  dependencies: [],
  metadata: {
    description: "Core infrastructure services",
  },

  register: (registry) => {
    // Register config (async import)
    registry.registerService(
      "core.config",
      async () => {
        const { config } = await import("../../shared/config/index.js");
        return config;
      },
      { singleton: true, lazy: false }
    );

    // Register logger (depends on config)
    registry.registerService(
      "core.logger",
      async (reg) => {
        const config = await reg.resolveAsync("core.config");
        const Logger = await import("../../shared/logger/index.js");
        return new Logger.default(config.env, config.logLevel);
      },
      { singleton: true, lazy: false, dependencies: ["core.config"] }
    );

    // Register database (depends on config, logger)
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

    // Register Redis (depends on config, logger)
    registry.registerService(
      "core.redis",
      async (reg) => {
        const config = await reg.resolveAsync("core.config");
        const logger = await reg.resolveAsync("core.logger");
        const RedisManager = await import("../../shared/redis/index.js");
        return new RedisManager.default(config.redis, logger);
      },
      {
        singleton: true,
        lazy: false,
        dependencies: ["core.config", "core.logger"],
      }
    );

    // Register EventBus (depends on redis, logger)
    registry.registerService(
      "core.eventBus",
      async (reg) => {
        const redis = await reg.resolveAsync("core.redis");
        const logger = await reg.resolveAsync("core.logger");
        const EventBus = await import("../../shared/events/EventBus.js");
        return new EventBus.default(redis.pubClient, redis.subClient, logger);
      },
      {
        singleton: true,
        lazy: false,
        dependencies: ["core.redis", "core.logger"],
      }
    );
  },

  init: async (registry) => {
    const logger = await registry.resolveAsync("core.logger");
    const database = await registry.resolveAsync("core.database");
    const redis = await registry.resolveAsync("core.redis");

    logger.info("🚀 Initializing core infrastructure...");

    // Connect database
    await database.connect();

    // Connect Redis
    if (redis.connect && typeof redis.connect === "function") {
      await redis.connect();
    }

    logger.info("✅ Core infrastructure initialized");
  },

  destroy: async (registry) => {
    const logger = await registry.resolveAsync("core.logger");
    const database = await registry.resolveAsync("core.database");

    logger.info("🛑 Shutting down core infrastructure...");

    if (database.disconnect) {
      await database.disconnect();
    }
  },
};
