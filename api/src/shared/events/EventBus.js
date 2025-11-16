class EventBus {
  constructor({ pubClient, subClient, logger }) {
    this.pubClient = pubClient;
    this.subClient = subClient;
    this.logger = logger;
    this.handlers = new Map(); // eventName -> Set of handler functions
  }

  async subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
      await this.subClient.subscribe(eventName);
      this.logger.info(`Subscribed to "${eventName}"`);
    }

    this.handlers.get(eventName).add(handler);
  }

  async unsubscribe(eventName, handler) {
    const handlers = this.handlers.get(eventName);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.handlers.delete(eventName);
      await this.subClient.unsubscribe(eventName);
      this.logger.info(`Unsubscribed from "${eventName}"`);
    }
  }

  async publish(eventName, data) {
    const payload = JSON.stringify({
      event: eventName,
      data,
      timestamp: Date.now(),
    });

    await this.pubClient.publish(eventName, payload);
    this.logger.debug(`Published "${eventName}"`, { data });
  }

  startListening() {
    this.subClient.on('message', async (channel, message) => {
      try {
        const { event, data } = JSON.parse(message);
        const handlers = this.handlers.get(event);

        if (!handlers || handlers.size === 0) return;

        // Execute all handlers for this event
        const results = await Promise.allSettled(
          Array.from(handlers).map((handler) => handler(data))
        );

        // Log failures
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            this.logger.error(`Handler ${index} failed for "${event}"`, result.reason);
          }
        });
      } catch (error) {
        this.logger.error(`EventBus: Error processing event "${channel}"`, error);
      }
    });

    this.logger.info('EventBus: Started listening for events');
  }

  stopListening() {
    this.subClient.removeAllListeners('message');
    this.logger.info('EventBus: Stopped listening');
  }
}

export default EventBus;
