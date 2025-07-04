import type { LogEntry, Logger, LogLevel } from '../middleware/types';

export interface LoggerOptions {
  debug?: boolean;
  baseLogger?: Logger;
}

/**
 * Create a default console-based logger implementation.
 *
 * Creates a simple logger that outputs to the console with level prefixes.
 * This is the fallback logger used when no custom logger is provided.
 * Suitable for development and simple deployments.
 *
 * @returns Logger implementation using console output
 *
 * @example Using default logger
 * ```typescript
 * const logger = createDefaultLogger();
 *
 * logger.info('Server starting');
 * logger.error('Connection failed', { error: 'ECONNREFUSED' });
 * logger.debug('Processing request', { method: 'tools/list' });
 * ```
 *
 * @example In middleware configuration
 * ```typescript
 * const errorMapper = createErrorMapperMiddleware({
 *   logger: createDefaultLogger(),
 *   enableLogging: true
 * });
 * ```
 */
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

/**
 * Create a stderr-only logger that avoids stdout pollution.
 *
 * Creates a logger that writes all output to stderr using structured JSON format.
 * This is safe for stdio transports because MCP clients only read from stdin/stdout,
 * not stderr. Stderr output won't interfere with JSON-RPC message exchange.
 *
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
 * @example In middleware configuration for stdio transport
 * ```typescript
 * const loggingMiddleware = createBuiltInLoggingMiddleware({
 *   logger: (level, message, data) => {
 *     const stderrLogger = createStderrLogger();
 *     stderrLogger.log(level, message, data);
 *   }
 * });
 * ```
 */
export function createStderrLogger(): Logger {
  const writeToStderr = (level: LogLevel, message: string, meta?: LogEntry): void => {
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    };

    // biome-ignore lint/suspicious/noConsole: Stderr logger specifically uses console.error for stderr output
    console.error(JSON.stringify(logData));
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
 * console.log(traceId); // "req-a7b3c9d2"
 *
 * // Use in middleware
 * const tracingMiddleware: Middleware = async (ctx, next) => {
 *   ctx.state.traceId = generateTraceId();
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
 *   console.log('Debug mode enabled');
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
 * const baseLogger = createDefaultLogger();
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
