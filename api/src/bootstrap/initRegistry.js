import { ModuleRegistry } from "../core/registry/ModuleRegistry.js";
import { ModuleLoader } from "../core/loader/ModuleLoader.js";
import coreModule from "../core/modules/core.module.js";

/**
 * Initialize registry and load all modules
 */
export const initRegistry = async () => {
  // Create registry
  const registry = new ModuleRegistry();

  // Register core module
  registry.registerModule(coreModule);
  await registry.initModule("core");

  // Update logger
  const logger = await registry.resolveAsync("core.logger");
  registry.setLogger(logger);

  // Load business modules (skip if directory doesn't exist)
  const loader = new ModuleLoader(registry);
  const loadedModules = await loader.loadAllModules();

  logger.info(
    `📦 Registry initialized: ${registry.listServices().length} services, ${loadedModules.length} modules`
  );

  return registry;
};

export default initRegistry;
