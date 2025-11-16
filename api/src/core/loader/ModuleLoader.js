import { readdir, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { constants } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ModuleLoader - Discovers and loads modules dynamically
 * FIXED: Windows path support for dynamic imports
 */
export class ModuleLoader {
  constructor(registry, modulesPath = null) {
    this.registry = registry;
    this.modulesPath = modulesPath || join(__dirname, "../../modules");
    this.loadedModules = new Set();
  }

  /**
   * Load all modules from modules directory
   */
  async loadAllModules() {
    try {
      // Check if modules directory exists
      try {
        await access(this.modulesPath, constants.F_OK);
      } catch {
        console.log(
          `ℹ️  No modules directory found at ${this.modulesPath} - skipping module loading`
        );
        return [];
      }

      const entries = await readdir(this.modulesPath, { withFileTypes: true });
      const moduleDirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      if (moduleDirs.length === 0) {
        console.log("ℹ️  No modules found in modules directory");
        return [];
      }

      console.log(
        `🔍 Discovered ${moduleDirs.length} modules: ${moduleDirs.join(", ")}`
      );

      // Load modules
      const modules = [];
      for (const dir of moduleDirs) {
        const module = await this.loadModule(dir);
        if (module) modules.push(module);
      }

      // Sort by dependencies (topological sort)
      const sorted = this._sortByDependencies(modules);

      // Register in order
      for (const module of sorted) {
        this.registry.registerModule(module);
        this.loadedModules.add(module.name);
      }

      // Initialize all
      await this.registry.initAllModules();

      console.log(`✅ Loaded ${modules.length} business modules`);
      return modules;
    } catch (error) {
      throw new Error(`Module loading failed: ${error.message}`);
    }
  }

  /**
   * Load single module by name
   * FIXED: Convert Windows paths to file:// URLs
   */
  async loadModule(name) {
    try {
      const modulePath = join(this.modulesPath, name, "index.js");

      // Convert absolute path to file:// URL (cross-platform)
      const moduleUrl = pathToFileURL(modulePath).href;

      const module = await import(moduleUrl);
      const definition = module.default;

      if (!definition) {
        throw new Error(`Module '${name}' missing default export`);
      }

      this._validateModule(definition, name);
      return definition;
    } catch (error) {
      console.error(`❌ Failed to load module '${name}':`, error.message);
      return null;
    }
  }

  /**
   * Validate module definition
   */
  _validateModule(definition, expectedName) {
    const required = ["name", "register"];
    const missing = required.filter((field) => !definition[field]);

    if (missing.length > 0) {
      throw new Error(
        `Module '${expectedName}' missing required fields: ${missing.join(", ")}`
      );
    }

    if (definition.name !== expectedName) {
      throw new Error(
        `Module name mismatch: expected '${expectedName}', got '${definition.name}'`
      );
    }

    if (typeof definition.register !== "function") {
      throw new Error(
        `Module '${definition.name}' register must be a function`
      );
    }

    if (definition.init && typeof definition.init !== "function") {
      throw new Error(`Module '${definition.name}' init must be a function`);
    }
  }

  /**
   * Topological sort modules by dependencies
   */
  _sortByDependencies(modules) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (module) => {
      if (visited.has(module.name)) return;
      if (visiting.has(module.name)) {
        throw new Error(`Circular module dependency: ${module.name}`);
      }

      visiting.add(module.name);

      const deps = module.dependencies || [];
      for (const depName of deps) {
        // Skip core dependencies
        if (depName.startsWith("core.")) continue;

        const depModule = modules.find((m) => m.name === depName);
        if (depModule) {
          visit(depModule);
        }
      }

      visiting.delete(module.name);
      visited.add(module.name);
      sorted.push(module);
    };

    for (const module of modules) {
      visit(module);
    }

    return sorted;
  }
}

export default ModuleLoader;
