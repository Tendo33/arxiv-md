// 统一的日志工具 - 支持不同级别的日志输出

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor(namespace = 'ArxivMD') {
    this.namespace = namespace;
    this.level =
      process.env.NODE_ENV === 'production'
        ? LOG_LEVELS.WARN
        : LOG_LEVELS.DEBUG;
  }

  _log(level, levelName, ...args) {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${this.namespace}] [${levelName}]`;
      console[levelName.toLowerCase()](prefix, ...args);
    }
  }

  error(...args) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', ...args);
  }

  warn(...args) {
    this._log(LOG_LEVELS.WARN, 'WARN', ...args);
  }

  info(...args) {
    this._log(LOG_LEVELS.INFO, 'INFO', ...args);
  }

  debug(...args) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', ...args);
  }
}

// 导出单例
export default new Logger('ArxivMD');
