import { RpcError } from '@hexmcp/codec-jsonrpc';
import { calculateDuration, createDefaultLogger, generateTraceId, isDebugMode } from '../utils/logger';
import type { Logger, Middleware, RequestContext } from './types';

export interface ContextLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

export interface LoggerRequestContext extends RequestContext {
  log: ContextLogger;
  state: RequestContext['state'] & {
    logger: ContextLogger;
    traceId: string;
    startTime: number;
  };
}

export interface LoggerMiddlewareOptions {
  baseLogger?: Logger;
  debug?: boolean;
}

export interface LoggingMiddlewareOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeRequest?: boolean;
  includeResponse?: boolean;
  includeMetadata?: boolean;
  logger?: (level: string, message: string, data?: unknown) => void;
}

interface StructuredLogData extends Record<string, unknown> {
  traceId: string;
  method: string;
  transport: string;
  status: 'ok' | 'error';
  durationMs: number;
  code?: number;
  error?: string;
}

export function loggerMiddleware(options: LoggerMiddlewareOptions = {}): Middleware {
  const baseLogger = options.baseLogger || createDefaultLogger();
  const debugMode = options.debug !== undefined ? options.debug : isDebugMode();

  return async (ctx: RequestContext, next: () => Promise<void>) => {
    const traceId = (ctx.state.traceId as string) || generateTraceId();
    const startTime = Date.now();

    const contextLogger = createContextLogger(baseLogger, traceId);

    // Extend the context with logger functionality
    const loggerCtx = ctx as LoggerRequestContext;
    loggerCtx.state.traceId = traceId;
    loggerCtx.state.startTime = startTime;
    loggerCtx.state.logger = contextLogger;
    loggerCtx.log = contextLogger;

    const baseLogData = {
      traceId,
      method: ctx.request.method,
      transport: ctx.transport.name,
    };

    if (debugMode) {
      contextLogger.debug('Request started', baseLogData);
    }

    try {
      await next();

      const durationMs = calculateDuration(startTime);
      const successLogData: StructuredLogData = {
        ...baseLogData,
        status: 'ok',
        durationMs,
      };

      contextLogger.info('Request completed', successLogData);
    } catch (error) {
      const durationMs = calculateDuration(startTime);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof RpcError ? error.code : -32000;

      const errorLogData: StructuredLogData = {
        ...baseLogData,
        status: 'error',
        durationMs,
        code: errorCode,
        error: errorMessage,
      };

      contextLogger.error('Request failed', errorLogData);

      throw error;
    }
  };
}

function createContextLogger(baseLogger: Logger, traceId: string): ContextLogger {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      const logData = { ...data, traceId };
      const logEntry = {
        timestamp: Date.now(),
        level: 'debug' as const,
        message,
        metadata: {
          source: 'error-mapper' as const,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          ...logData,
        },
      };
      baseLogger.debug(message, logEntry);
    },
    info: (message: string, data?: Record<string, unknown>) => {
      const logData = { ...data, traceId };
      const logEntry = {
        timestamp: Date.now(),
        level: 'info' as const,
        message,
        metadata: {
          source: 'error-mapper' as const,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          ...logData,
        },
      };
      baseLogger.info(message, logEntry);
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      const logData = { ...data, traceId };
      const logEntry = {
        timestamp: Date.now(),
        level: 'warn' as const,
        message,
        metadata: {
          source: 'error-mapper' as const,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          ...logData,
        },
      };
      baseLogger.warn(message, logEntry);
    },
    error: (message: string, data?: Record<string, unknown>) => {
      const logData = { ...data, traceId };
      const logEntry = {
        timestamp: Date.now(),
        level: 'error' as const,
        message,
        metadata: {
          source: 'error-mapper' as const,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          ...logData,
        },
      };
      baseLogger.error(message, logEntry);
    },
  };
}

export function createBuiltInLoggingMiddleware(options: LoggingMiddlewareOptions = {}): Middleware {
  const adaptedLogger: Logger | undefined = options.logger
    ? {
        error: (message: string, meta?: unknown) => {
          if (options.logger) {
            options.logger('error', message, meta);
          }
        },
        warn: (message: string, meta?: unknown) => {
          if (options.logger) {
            options.logger('warn', message, meta);
          }
        },
        info: (message: string, meta?: unknown) => {
          if (options.logger) {
            options.logger('info', message, meta);
          }
        },
        debug: (message: string, meta?: unknown) => {
          if (options.logger) {
            options.logger('debug', message, meta);
          }
        },
        log: (level: string, message: string, meta?: unknown) => {
          if (options.logger) {
            options.logger(level, message, meta);
          }
        },
      }
    : undefined;

  const loggerOptions: LoggerMiddlewareOptions = {
    debug: options.level === 'debug',
  };

  if (adaptedLogger) {
    loggerOptions.baseLogger = adaptedLogger;
  }

  return loggerMiddleware(loggerOptions);
}
