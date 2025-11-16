/**
 * ModuleRegistry - Central service registry with DI container
 * Supports async factories for dynamic ESM imports
 */
export class ModuleRegistry {
  constructor() {
    this._services = new Map();
    this._instances = new Map();
    this._metadata = new Map();
    this._modules = new Map();
    this._initializing = new Set();
    this._logger = console;
  }

  registerService(key, factory, options = {}) {
    if (this._services.has(key)) {
      throw new Error(`Service '${key}' already registered`);
    }

    const config = {
      singleton: options.singleton ?? true,
      lazy: options.lazy ?? true,
      dependencies: options.dependencies || [],
      factory,
      metadata: options.metadata || {},
    };

    this._services.set(key, config);
    this._metadata.set(key, {
      registeredAt: Date.now(),
      resolved: false,
      resolveCount: 0,
    });

    this._logger.debug?.(`✅ Registered: ${key}`);
  }

  /**
   * Synchronous resolve - throws if factory is async
   */
  resolve(key) {
    const config = this._services.get(key);
    if (!config) {
      throw new Error(
        `Service '${key}' not registered. Available: ${[...this._services.keys()].join(", ")}`
      );
    }

    // Return cached singleton
    if (config.singleton && this._instances.has(key)) {
      this._updateMetadata(key);
      return this._instances.get(key);
    }

    throw new Error(
      `Service '${key}' not initialized. Use resolveAsync() for async factories.`
    );
  }

  /**
   * Async resolve - supports dynamic imports and async initialization
   */
  async resolveAsync(key) {
    const config = this._services.get(key);
    if (!config) {
      throw new Error(
        `Service '${key}' not registered. Available: ${[...this._services.keys()].join(", ")}`
      );
    }

    // Return cached singleton
    if (config.singleton && this._instances.has(key)) {
      this._updateMetadata(key);
      return this._instances.get(key);
    }

    // Circular dependency detection
    if (this._initializing.has(key)) {
      const chain = [...this._initializing, key].join(" → ");
      throw new Error(`Circular dependency detected: ${chain}`);
    }

    try {
      this._initializing.add(key);

      // Resolve dependencies first (all async)
      const deps = await Promise.all(
        config.dependencies.map((depKey) => this.resolveAsync(depKey))
      );

      // Create instance (support both sync and async factories)
      const result =
        typeof config.factory === "function"
          ? config.factory(this, ...deps)
          : config.factory;

      // Await if promise
      const instance = result instanceof Promise ? await result : result;

      // Cache singleton
      if (config.singleton) {
        this._instances.set(key, instance);
      }

      this._updateMetadata(key, true);
      this._logger.debug?.(`🔧 Resolved: ${key}`);

      return instance;
    } catch (error) {
      throw new Error(`Failed to resolve '${key}': ${error.message}`);
    } finally {
      this._initializing.delete(key);
    }
  }

  has(key) {
    return this._services.has(key);
  }

  getMetadata(key) {
    return this._metadata.get(key);
  }

  listServices() {
    return Array.from(this._services.keys());
  }

  registerModule(moduleDefinition) {
    const { name, version = "1.0.0", dependencies = [] } = moduleDefinition;

    if (this._modules.has(name)) {
      throw new Error(`Module '${name}' already registered`);
    }

    this._modules.set(name, {
      definition: moduleDefinition,
      registeredAt: Date.now(),
      initialized: false,
    });

    this._logger.info?.(`📦 Module registered: ${name}@${version}`);
  }

  async initModule(name) {
    const module = this._modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not registered`);
    }

    if (module.initialized) {
      this._logger.warn?.(`Module '${name}' already initialized`);
      return;
    }

    const { definition } = module;

    try {
      // Call register hook (synchronous service registration)
      if (definition.register) {
        definition.register(this);
      }

      // Call init hook (async initialization)
      if (definition.init) {
        await definition.init(this);
      }

      module.initialized = true;
      this._logger.info?.(`✅ Module initialized: ${name}`);
    } catch (error) {
      throw new Error(
        `Failed to initialize module '${name}': ${error.message}`
      );
    }
  }

  async initAllModules() {
    const names = Array.from(this._modules.keys());
    for (const name of names) {
      await this.initModule(name);
    }
  }

  setLogger(logger) {
    this._logger = logger;
  }

  clear() {
    this._services.clear();
    this._instances.clear();
    this._metadata.clear();
    this._modules.clear();
    this._initializing.clear();
  }

  _updateMetadata(key, resolved = false) {
    const meta = this._metadata.get(key);
    if (meta) {
      meta.resolveCount++;
      if (resolved) meta.resolved = true;
    }
  }
}

export default ModuleRegistry;
