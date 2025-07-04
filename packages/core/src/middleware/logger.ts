import { RpcError } from '@hexmcp/codec-jsonrpc';
import { calculateDuration, createDefaultLogger, createStderrLogger, generateTraceId, isDebugMode } from '../utils/logger';
import type { Logger, Middleware, RequestContext, StreamingRequestContext } from './types';

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

/**
 * Configuration options for the built-in logging middleware.
 *
 * The middleware automatically selects an appropriate logger based on the transport:
 * - For 'stdio' transport: Uses stderr-only logger to avoid stdout pollution
 * - For other transports: Uses default console logger
 * - Custom logger: Overrides automatic selection
 */
export interface LoggingMiddlewareOptions {
  /** Log level threshold for filtering messages */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to include request data in logs */
  includeRequest?: boolean;
  /** Whether to include response data in logs */
  includeResponse?: boolean;
  /** Whether to include transport metadata in logs */
  includeMetadata?: boolean;
  /**
   * Custom logger function. When provided, overrides automatic transport-aware logger selection.
   * For stdio transport compatibility, ensure this function writes to stderr or external systems only.
   */
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
  return async (ctx: RequestContext, next: () => Promise<void>) => {
    let baseLogger: Logger;

    if (options.logger) {
      baseLogger = {
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
      };
    } else {
      const isStdio = ctx.transport.name === 'stdio';
      baseLogger = isStdio ? createStderrLogger() : createDefaultLogger();
    }

    const loggerOptions: LoggerMiddlewareOptions = {
      debug: options.level === 'debug',
      baseLogger,
    };

    const middleware = loggerMiddleware(loggerOptions);
    return middleware(ctx, next);
  };
}

/**
 * Create middleware that adds streaming info support to the request context.
 *
 * This middleware extends the RequestContext with a streamInfo method that allows
 * handlers to send progress updates to clients via streaming transports. For stdio
 * transport, the streamInfo method is not added since stdio doesn't support
 * streaming info messages (they would interfere with JSON-RPC protocol).
 *
 * @returns Middleware that adds streamInfo functionality
 *
 * @example Adding streaming support to middleware stack
 * ```typescript
 * const builder = createMcpKitServer()
 *   .use(createStreamingInfoMiddleware())
 *   .use(builtIn.logging())
 *   .tool('process-data', processDataTool);
 * ```
 *
 * @example Using streamInfo in a tool handler
 * ```typescript
 * const processDataTool: ToolDefinition = {
 *   name: 'process-data',
 *   description: 'Process large dataset with progress updates',
 *   handler: async (args, ctx) => {
 *     const streamingCtx = ctx as StreamingRequestContext;
 *
 *     streamingCtx.streamInfo?.('Starting data processing...');
 *     await processStep1(args);
 *
 *     streamingCtx.streamInfo?.('Processing step 2 of 3...');
 *     await processStep2(args);
 *
 *     streamingCtx.streamInfo?.('Finalizing results...');
 *     const result = await processStep3(args);
 *
 *     return { content: [{ type: 'text', text: result }] };
 *   }
 * };
 * ```
 */
export function createStreamingInfoMiddleware(): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>) => {
    const streamingCtx = ctx as StreamingRequestContext;

    if (ctx.transport.name !== 'stdio') {
      streamingCtx.streamInfo = async (text: string) => {
        await ctx.send({ type: 'info', text });
      };
    }

    await next();
  };
}
