import { ModuleRegistry } from "../core/registry/ModuleRegistry.js";
import { ModuleLoader } from "../core/loader/ModuleLoader.js";
import loadEnvironment from "./loadEnv.js";
import coreModule from "../core/modules/core.module.js";

/**
 * Initialize registry and load all modules
 */
export const initRegistry = async () => {
  // STEP 1: Load environment FIRST
  loadEnvironment();

  // STEP 2: Create registry
  const registry = new ModuleRegistry();

  // STEP 3: Register core module
  registry.registerModule(coreModule);
  await registry.initModule("core");

  // STEP 4: Update logger
  const logger = await registry.resolve("core.logger");
  registry.setLogger(logger);

  // STEP 5: Load business modules
  const loader = new ModuleLoader(registry);
  await loader.loadAllModules();

  logger.info(
    `📦 Registry initialized with ${registry.listServices().length} services`
  );

  return registry;
};

export default initRegistry;
