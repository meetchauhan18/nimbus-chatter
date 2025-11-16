class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  _log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...meta,
    };

    if (this.isDev) {
      const emoji = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🔍',
      }[level];
      console.log(`${emoji} [${this.context}]`, message, meta);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message, meta) {
    this._log('info', message, meta);
  }

  warn(message, meta) {
    this._log('warn', message, meta);
  }

  error(message, error, meta) {
    this._log('error', message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }

  debug(message, meta) {
    if (this.isDev) {
      this._log('debug', message, meta);
    }
  }

  child(context) {
    return new Logger(`${this.context}:${context}`);
  }
}

export default Logger;
