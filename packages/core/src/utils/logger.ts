import type { LogEntry, Logger, LogLevel } from '../middleware/types';

export interface LoggerUtilOptions {
  debug?: boolean;
  baseLogger?: Logger;
}

/**
 * Configuration options for default logger creation.
 */
export interface DefaultLoggerOptions {
  /** Minimum log level to output (default: 'debug' - logs everything) */
  level?: LogLevel;
  /** Whether to disable logging entirely in test environments (default: true) */
  disableInTest?: boolean;
}

/**
 * Create a default console-based logger implementation.
 *
 * @internal This is an internal implementation detail used by createLogger().
 * Use createLogger() instead for public API usage as it provides transport-aware
 * logger selection and better defaults.
 *
 * @param options - Configuration options for the logger
 * @returns Logger implementation using console output
 */
export function createDefaultLogger(options: DefaultLoggerOptions = {}): Logger {
  const { level = 'debug', disableInTest = true } = options;

  const shouldLog = (logLevel: LogLevel): boolean => {
    if (disableInTest && process.env.NODE_ENV === 'test') {
      return false;
    }

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[logLevel] >= levels[level];
  };

  return {
    error: (message: string, meta?: LogEntry) => {
      if (shouldLog('error')) {
        // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
        console.error('[error]', message, meta);
      }
    },
    warn: (message: string, meta?: LogEntry) => {
      if (shouldLog('warn')) {
        // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
        console.warn('[warn]', message, meta);
      }
    },
    info: (message: string, meta?: LogEntry) => {
      if (shouldLog('info')) {
        // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
        console.log('[info]', message, meta);
      }
    },
    debug: (message: string, meta?: LogEntry) => {
      if (shouldLog('debug')) {
        // biome-ignore lint/suspicious/noConsole: Default logger needs console for fallback
        console.log('[debug]', message, meta);
      }
    },
    log: (logLevel: LogLevel, message: string, meta?: LogEntry) => {
      if (!shouldLog(logLevel)) {
        return;
      }

      switch (logLevel) {
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

/**
 * Configuration options for stderr logger creation.
 */
export interface StderrLoggerOptions {
  /** Minimum log level to output (default: 'debug' - logs everything) */
  level?: LogLevel;
  /** Whether to disable logging entirely in test environments (default: true) */
  disableInTest?: boolean;
  /** Whether to use compact JSON format (default: false) */
  compact?: boolean;
}

/**
 * Create a stderr-only logger that avoids stdout pollution.
 *
 * Creates a logger that writes all output to stderr using structured JSON format.
 * This is safe for stdio transports because MCP clients only read from stdin/stdout,
 * not stderr. Stderr output won't interfere with JSON-RPC message exchange.
 *
 * @param options - Configuration options for the logger
 * @returns Logger implementation using stderr-only output
 *
 * @example Using stderr logger for stdio transport
 * ```typescript
 * const logger = createStderrLogger();
 *
 * logger.info('Server starting');
 * logger.error('Connection failed', { error: 'ECONNREFUSED' });
 * ```
 *
 * @example With log level filtering
 * ```typescript
 * const logger = createStderrLogger({ level: 'warn', compact: true });
 * logger.debug('This will be ignored');
 * logger.warn('This will be logged in compact format');
 * ```
 *
 * @example In middleware configuration for stdio transport
 * ```typescript
 * const loggingMiddleware = createBuiltInLoggingMiddleware({
 *   logger: (level, message, data) => {
 *     const stderrLogger = createStderrLogger({ level: 'info' });
 *     stderrLogger.log(level, message, data);
 *   }
 * });
 * ```
 */
export function createStderrLogger(options: StderrLoggerOptions = {}): Logger {
  const { level = 'debug', disableInTest = true, compact = false } = options;

  const shouldLog = (logLevel: LogLevel): boolean => {
    if (disableInTest && process.env.NODE_ENV === 'test') {
      return false;
    }

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[logLevel] >= levels[level];
  };

  const writeToStderr = (logLevel: LogLevel, message: string, meta?: LogEntry): void => {
    if (!shouldLog(logLevel)) {
      return;
    }

    const logData = {
      level: logLevel,
      message,
      timestamp: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    };

    // biome-ignore lint/suspicious/noConsole: Stderr logger specifically uses console.error for stderr output
    console.error(compact ? JSON.stringify(logData) : JSON.stringify(logData, null, 2));
  };

  return {
    error: (message: string, meta?: LogEntry) => writeToStderr('error', message, meta),
    warn: (message: string, meta?: LogEntry) => writeToStderr('warn', message, meta),
    info: (message: string, meta?: LogEntry) => writeToStderr('info', message, meta),
    debug: (message: string, meta?: LogEntry) => writeToStderr('debug', message, meta),
    log: (level: LogLevel, message: string, meta?: LogEntry) => writeToStderr(level, message, meta),
  };
}

/**
 * Create a silent logger that discards all log output.
 *
 * Creates a no-op logger that silently discards all log messages.
 * Useful for stdio transports when you want to completely disable logging
 * to avoid any potential interference with the JSON-RPC protocol.
 *
 * @returns Logger implementation that discards all output
 *
 * @example Using silent logger for stdio transport
 * ```typescript
 * const logger = createSilentLogger();
 *
 * logger.info('This will be discarded');
 * logger.error('This will also be discarded');
 * ```
 *
 * @example In middleware configuration for stdio transport
 * ```typescript
 * const loggingMiddleware = createBuiltInLoggingMiddleware({
 *   logger: () => {} // Silent logger function
 * });
 * ```
 */
export function createSilentLogger(): Logger {
  const noop = (): void => {
    // Intentionally empty - silent logger discards all output
  };

  return {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    log: noop,
  };
}

/**
 * Configuration options for logger creation and selection.
 */
export interface LoggerOptions {
  /** Transport name for automatic logger selection */
  transport?: string;
  /** Minimum log level to output (default: 'info') */
  level?: LogLevel;
  /** Whether to disable logging entirely in test environments (default: true) */
  disableInTest?: boolean;
  /** Whether to use compact JSON format for stderr logger (default: true) */
  compact?: boolean;
  /** Force silent logger regardless of other options (default: false) */
  silent?: boolean;
}

/**
 * Create a logger with automatic implementation selection based on context.
 *
 * This function serves as a facade that automatically selects the most appropriate
 * logger implementation based on:
 * - Transport type (stdio uses stderr-only logger, others use console logger)
 * - Environment (test environment can disable logging)
 * - Configuration preferences (silent mode, log levels, output format)
 * - Runtime context and requirements
 *
 * @param options - Configuration options for logger selection
 * @returns Logger implementation selected based on provided context
 *
 * @example Automatic transport-aware logger selection
 * ```typescript
 * const logger = createLogger({ transport: 'stdio', level: 'warn' });
 * logger.debug('Ignored - below threshold');
 * logger.warn('Logged to stderr in JSON format');
 * ```
 *
 * @example Environment-aware logger selection
 * ```typescript
 * const logger = createLogger({
 *   level: 'error',
 *   compact: true,
 *   disableInTest: true
 * });
 * ```
 *
 * @example Silent logger selection
 * ```typescript
 * const logger = createLogger({ silent: true });
 * logger.error('This will be discarded');
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { transport, level = 'info', disableInTest = true, compact = true, silent = false } = options;

  if (silent) {
    return createSilentLogger();
  }

  if (disableInTest && process.env.NODE_ENV === 'test') {
    return createSilentLogger();
  }

  const isStdio = transport === 'stdio';

  if (isStdio) {
    return createStderrLogger({ level, disableInTest, compact });
  }

  return createDefaultLogger({ level, disableInTest });
}

/**
 * Generate a unique trace ID for request tracking.
 *
 * Creates a random trace ID with 'req-' prefix for identifying and correlating
 * log entries across the request lifecycle. Used by logging and tracing middleware.
 *
 * @returns Unique trace ID string
 *
 * @example
 * ```typescript
 * const traceId = generateTraceId();
 * // traceId will be something like "req-a7b3c9d2"
 *
 * // Use in middleware with structured logging
 * const tracingMiddleware: Middleware = async (ctx, next) => {
 *   ctx.state.traceId = generateTraceId();
 *
 *   // Log with structured data instead of console
 *   const logger = createLogger({ transport: ctx.transport.name });
 *   logger.info('Request started', {
 *     traceId: ctx.state.traceId,
 *     method: ctx.request.method
 *   });
 *
 *   await next();
 * };
 * ```
 */
export function generateTraceId(): string {
  return `req-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Check if debug mode is enabled via environment variable.
 *
 * Checks the MCPKIT_DEBUG environment variable to determine if debug mode
 * is enabled. Debug mode affects logging verbosity, error detail inclusion,
 * and other development-friendly features.
 *
 * @returns True if MCPKIT_DEBUG environment variable is set to '1'
 *
 * @example
 * ```typescript
 * // Set environment variable
 * process.env.MCPKIT_DEBUG = '1';
 *
 * if (isDebugMode()) {
 *   // Use structured logging instead of console
 *   const logger = createLogger({ level: 'debug' });
 *   logger.debug('Debug mode enabled', {
 *     debugMode: true,
 *     environment: process.env.NODE_ENV
 *   });
 *   // Enable verbose logging, stack traces, etc.
 * }
 * ```
 *
 * @example In middleware configuration
 * ```typescript
 * const errorMapper = createErrorMapperMiddleware({
 *   debugMode: isDebugMode(),
 *   includeStackTrace: isDebugMode(),
 *   logLevel: isDebugMode() ? 'debug' : 'error'
 * });
 * ```
 */
export function isDebugMode(): boolean {
  return process.env.MCPKIT_DEBUG === '1';
}

/**
 * @internal
 */
export function calculateDuration(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * @internal
 */
export function formatLogMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formatted[key] = value;
    }
  }

  return formatted;
}

/**
 * Create a child logger with additional metadata context.
 *
 * Creates a child logger that inherits from a base logger and automatically
 * includes additional metadata in all log entries. If the base logger supports
 * child logger creation (like Pino or Bunyan), it uses that feature. Otherwise,
 * it creates a wrapper that includes the metadata.
 *
 * @param baseLogger - The parent logger to extend
 * @param metadata - Additional metadata to include in all log entries
 * @returns Child logger with enhanced context
 *
 * @example Creating child logger with request context
 * ```typescript
 * const baseLogger = createLogger({ transport: 'stdio' });
 * const requestLogger = createChildLogger(baseLogger, {
 *   traceId: 'req-123',
 *   userId: 'user-456',
 *   method: 'tools/list'
 * });
 *
 * requestLogger.info('Processing request');
 * // Logs: [info] Processing request { traceId: 'req-123', userId: 'user-456', method: 'tools/list' }
 * ```
 *
 * @example In middleware for per-request logging
 * ```typescript
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   const requestLogger = createChildLogger(baseLogger, {
 *     traceId: ctx.state.traceId,
 *     method: ctx.request.method,
 *     transport: ctx.transport.name
 *   });
 *
 *   ctx.state.logger = requestLogger;
 *
 *   requestLogger.info('Request started');
 *   await next();
 *   requestLogger.info('Request completed');
 * };
 * ```
 *
 * @example With structured logger (Pino/Bunyan)
 * ```typescript
 * const pinoLogger = pino();
 * const childLogger = createChildLogger(pinoLogger, { service: 'mcp-server' });
 *
 * // If pinoLogger has child() method, it will be used
 * // Otherwise, falls back to wrapper implementation
 * ```
 */
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
