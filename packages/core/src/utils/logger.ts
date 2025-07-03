import type { LogEntry, Logger, LogLevel } from '../middleware/types';

export interface LoggerOptions {
  debug?: boolean;
  baseLogger?: Logger;
}

export function createDefaultLogger(): Logger {
  return {
    // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
    error: (message: string, meta?: LogEntry) => console.error('[error]', message, meta),
    // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
    warn: (message: string, meta?: LogEntry) => console.warn('[warn]', message, meta),
    // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
    info: (message: string, meta?: LogEntry) => console.log('[info]', message, meta),
    // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
    debug: (message: string, meta?: LogEntry) => console.log('[debug]', message, meta),
    log: (level: LogLevel, message: string, meta?: LogEntry) => {
      switch (level) {
        case 'error':
          // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
          console.error('[error]', message, meta);
          break;
        case 'warn':
          // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
          console.warn('[warn]', message, meta);
          break;
        case 'info':
          // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
          console.log('[info]', message, meta);
          break;
        case 'debug':
          // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
          console.log('[debug]', message, meta);
          break;
      }
    },
  };
}

export function generateTraceId(): string {
  return `req-${Math.random().toString(36).substring(2, 10)}`;
}

export function isDebugMode(): boolean {
  return process.env.MCPKIT_DEBUG === '1';
}

export function calculateDuration(startTime: number): number {
  return Date.now() - startTime;
}

export function formatLogMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formatted[key] = value;
    }
  }

  return formatted;
}

export function createChildLogger(baseLogger: Logger, metadata: Record<string, unknown>): Logger {
  const loggerWithChild = baseLogger as Logger & { child?: (meta: Record<string, unknown>) => Logger };
  if (typeof loggerWithChild.child === 'function') {
    return loggerWithChild.child(metadata);
  }

  return {
    error: (message: string, meta?: LogEntry) => {
      baseLogger.error(message, meta);
    },
    warn: (message: string, meta?: LogEntry) => {
      baseLogger.warn(message, meta);
    },
    info: (message: string, meta?: LogEntry) => {
      baseLogger.info(message, meta);
    },
    debug: (message: string, meta?: LogEntry) => {
      baseLogger.debug(message, meta);
    },
    log: (level: LogLevel, message: string, meta?: LogEntry) => {
      baseLogger.log(level, message, meta);
    },
  };
}
