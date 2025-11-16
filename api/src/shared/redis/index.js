import Redis from "ioredis";

class RedisManager {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.cacheClient = null;
    this.pubClient = null;
    this.subClient = null;
  }

  async connect() {
    const { host, port, password } = this.config;

    const baseConfig = {
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        this.logger?.error?.("Redis reconnecting due to error:", err.message);
        return true;
      },
      family: 4,
    };

    try {
      this.cacheClient = new Redis({
        ...baseConfig,
        keyPrefix: "cache:",
        db: 0,
      });
      this.pubClient = new Redis({ ...baseConfig, db: 1 });
      this.subClient = this.pubClient.duplicate();

      await Promise.all([
        this.cacheClient.ping(),
        this.pubClient.ping(),
        this.subClient.ping(),
      ]);

      this._setupEventListeners();

      this.logger?.info?.("✅ Redis Connected (cache + pub/sub)");

      // Return this (instance) with clients as properties
      return this;
    } catch (error) {
      this.logger?.error?.("❌ Redis Connection Error:", error.message);
      throw error;
    }
  }

  _setupEventListeners() {
    const clients = [
      { name: "cache", client: this.cacheClient },
      { name: "pub", client: this.pubClient },
      { name: "sub", client: this.subClient },
    ];

    clients.forEach(({ name, client }) => {
      client.on("error", (err) =>
        this.logger?.error?.(`Redis ${name} error:`, err.message)
      );
      client.on("reconnecting", () =>
        this.logger?.warn?.(`⚠️  Redis ${name} reconnecting...`)
      );
      client.on("ready", () => this.logger?.info?.(`✅ Redis ${name} ready`));
    });
  }

  async disconnect() {
    await Promise.all([
      this.cacheClient?.quit(),
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]);
    this.logger?.info?.("Redis disconnected");
  }

  async checkHealth() {
    try {
      const [cachePing, pubPing, subPing] = await Promise.all([
        this.cacheClient?.ping(),
        this.pubClient?.ping(),
        this.subClient?.ping(),
      ]);

      return {
        status: "connected",
        cache: cachePing === "PONG",
        pub: pubPing === "PONG",
        sub: subPing === "PONG",
      };
    } catch (error) {
      return { status: "error", message: error.message };
    }
  }

  getClients() {
    return {
      cacheClient: this.cacheClient,
      pubClient: this.pubClient,
      subClient: this.subClient,
    };
  }
}

export default RedisManager;
