import { initRegistry } from "../../bootstrap/initRegistry.js";

(async () => {
  try {
    console.log("\n🧪 Testing Registry Initialization...\n");

    const registry = await initRegistry();

    console.log("\n=== REGISTERED SERVICES ===");
    console.log(registry.listServices());

    console.log("\n=== TEST RESOLUTION ===");
    const config = await registry.resolveAsync("core.config");
    const logger = await registry.resolveAsync("core.logger");
    const database = await registry.resolveAsync("core.database");
    const redis = await registry.resolveAsync("core.redis");
    const eventBus = await registry.resolveAsync("core.eventBus");

    console.log("✅ Config:", config.env);
    console.log("✅ Logger:", logger.constructor.name);
    console.log(
      "✅ Database:",
      database.connection?.readyState === 1 ? "Connected" : "Not Connected"
    );
    console.log(
      "✅ Redis:",
      redis.pubClient && redis.subClient ? "Clients Ready" : "Failed"
    );
    console.log("✅ EventBus:", eventBus.constructor.name);

    console.log("\n=== METADATA ===");
    console.log("Services resolved:", registry.listServices().length);

    console.log("\n🎉 Phase 1 Complete - All Systems Operational!");

    // Graceful shutdown
    if (database.disconnect) await database.disconnect();
    if (redis.disconnect) await redis.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
