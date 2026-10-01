type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Tiny console logger behind an interface so any consumer depends on the
 * abstraction, not on `console` (Dependency Inversion).
 */
class ConsoleLogger implements Logger {
  constructor(private readonly scope: string) {}

  private write(level: Level, message: string, meta?: Record<string, unknown>): void {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} (${this.scope}) ${message}`;
    if (meta && Object.keys(meta).length > 0) console[level === 'debug' ? 'log' : level](line, meta);
    else console[level === 'debug' ? 'log' : level](line);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }
}

export const createLogger = (scope: string): Logger => new ConsoleLogger(scope);
