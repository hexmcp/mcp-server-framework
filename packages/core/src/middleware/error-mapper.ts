import { encodeJsonRpcError, JSON_RPC_ERROR_CODES, RpcError } from '@hexmcp/codec-jsonrpc';
import type {
  ErrorClassificationResult,
  ErrorLogData,
  ErrorMapperOptions,
  ErrorMappingResult,
  ErrorMetadata,
  LogEntry,
  Logger,
  LogLevel,
  LogMetadata,
  Middleware,
  RequestContext,
  RequestLogContext,
} from './types';
import { ErrorClassification, MiddlewareError, MiddlewareTimeoutError, ReentrantCallError } from './types';

function isDebugMode(options?: ErrorMapperOptions): boolean {
  if (options?.debugMode !== undefined) {
    return options.debugMode;
  }
  return process.env.MCPKIT_DEBUG === '1';
}

class DefaultLogger implements Logger {
  error(message: string, meta?: LogEntry): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: LogEntry): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: LogEntry): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: LogEntry): void {
    this.log('debug', message, meta);
  }

  log(level: LogLevel, message: string, meta?: LogEntry): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // Use stderr to avoid stdout pollution for stdio transport
    // biome-ignore lint/suspicious/noConsole: Structured logging output to stderr
    console.error(JSON.stringify(logData, null, 2));
  }
}

function createLogMetadata(): LogMetadata {
  return {
    source: 'error-mapper',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    correlationId: generateCorrelationId(),
  };
}

function generateCorrelationId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function createErrorLogData(error: unknown, classification: ErrorClassificationResult, mappedError: ErrorMappingResult): ErrorLogData {
  return {
    classification: classification.classification,
    severity: classification.severity,
    type: getErrorType(error),
    code: mappedError.code,
    message: mappedError.message,
    originalMessage: error instanceof Error ? error.message : String(error),
    data: mappedError.data,
  };
}

function createRequestLogContext(
  ctx: RequestContext,
  metadata: ErrorMetadata,
  includeRequestContext: boolean
): RequestLogContext | undefined {
  if (!includeRequestContext) {
    return undefined;
  }

  return {
    requestId: ctx.request.id,
    method: ctx.request.method,
    transport: ctx.transport.name,
    timestamp: metadata.timestamp,
    ...(metadata.middlewareIndex !== undefined && { middlewareIndex: metadata.middlewareIndex }),
    ...(metadata.executionId !== undefined && { executionId: metadata.executionId }),
    peer: ctx.transport.peer,
  };
}

function formatLogMessage(error: unknown, classification: ErrorClassificationResult, format: 'json' | 'text' = 'json'): string {
  if (format === 'text') {
    const errorType = getErrorType(error);
    const severity = classification.severity.toUpperCase();
    return `[${severity}] ${classification.classification}: ${errorType} - ${classification.message}`;
  }
  return 'Middleware error caught by error mapper';
}

function classifyError(error: unknown): ErrorClassificationResult {
  if (error instanceof RpcError) {
    return {
      classification: ErrorClassification.RPC_ERROR,
      code: error.code,
      message: error.message,
      preserveOriginalMessage: true,
      includeDebugInfo: false,
      severity: getSeverityFromCode(error.code),
    };
  }

  if (error instanceof MiddlewareError) {
    return {
      classification: ErrorClassification.MIDDLEWARE_ERROR,
      code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal error',
      preserveOriginalMessage: false,
      includeDebugInfo: true,
      severity: 'high',
    };
  }

  if (error instanceof MiddlewareTimeoutError) {
    return {
      classification: ErrorClassification.MIDDLEWARE_TIMEOUT,
      code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal error',
      preserveOriginalMessage: false,
      includeDebugInfo: true,
      severity: 'high',
    };
  }

  if (error instanceof ReentrantCallError) {
    return {
      classification: ErrorClassification.REENTRANT_CALL,
      code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal error',
      preserveOriginalMessage: false,
      includeDebugInfo: true,
      severity: 'critical',
    };
  }

  if (error instanceof Error) {
    const classification = classifyStandardError(error);
    return {
      classification,
      code: getCodeForClassification(classification),
      message: 'Internal error',
      preserveOriginalMessage: false,
      includeDebugInfo: true,
      severity: getSeverityForClassification(classification),
    };
  }

  return {
    classification: ErrorClassification.UNKNOWN_ERROR,
    code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal error',
    preserveOriginalMessage: false,
    includeDebugInfo: true,
    severity: 'medium',
  };
}

function classifyStandardError(error: Error): ErrorClassification {
  const errorName = error.constructor.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();

  if (errorName.includes('validation') || errorMessage.includes('validation')) {
    return ErrorClassification.VALIDATION_ERROR;
  }
  if (errorName.includes('auth') || errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
    return ErrorClassification.AUTHENTICATION_ERROR;
  }
  if (errorName.includes('permission') || errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
    return ErrorClassification.AUTHORIZATION_ERROR;
  }
  if (errorName.includes('timeout') || errorMessage.includes('timeout')) {
    return ErrorClassification.TIMEOUT_ERROR;
  }
  if (errorName.includes('network') || errorName.includes('connection') || errorMessage.includes('network')) {
    return ErrorClassification.NETWORK_ERROR;
  }
  if (errorName.includes('parse') || errorMessage.includes('parse') || errorMessage.includes('syntax')) {
    return ErrorClassification.PARSE_ERROR;
  }
  if (errorName.includes('rate') || errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return ErrorClassification.RATE_LIMIT_ERROR;
  }

  return ErrorClassification.STANDARD_ERROR;
}

function getSeverityFromCode(code: number): 'low' | 'medium' | 'high' | 'critical' {
  if (code >= -32099 && code <= -32000) {
    return 'medium';
  }
  if (code === JSON_RPC_ERROR_CODES.PARSE_ERROR) {
    return 'high';
  }
  if (code === JSON_RPC_ERROR_CODES.INVALID_REQUEST) {
    return 'medium';
  }
  if (code === JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND) {
    return 'low';
  }
  if (code === JSON_RPC_ERROR_CODES.INVALID_PARAMS) {
    return 'medium';
  }
  if (code === JSON_RPC_ERROR_CODES.INTERNAL_ERROR) {
    return 'high';
  }
  return 'medium';
}

function getCodeForClassification(classification: ErrorClassification): number {
  switch (classification) {
    case ErrorClassification.VALIDATION_ERROR:
      return JSON_RPC_ERROR_CODES.INVALID_PARAMS;
    case ErrorClassification.AUTHENTICATION_ERROR:
    case ErrorClassification.AUTHORIZATION_ERROR:
      return -32001;
    case ErrorClassification.RATE_LIMIT_ERROR:
      return -32002;
    case ErrorClassification.TIMEOUT_ERROR:
      return -32003;
    case ErrorClassification.NETWORK_ERROR:
      return -32004;
    case ErrorClassification.PARSE_ERROR:
      return JSON_RPC_ERROR_CODES.PARSE_ERROR;
    default:
      return JSON_RPC_ERROR_CODES.INTERNAL_ERROR;
  }
}

function getSeverityForClassification(classification: ErrorClassification): 'low' | 'medium' | 'high' | 'critical' {
  switch (classification) {
    case ErrorClassification.REENTRANT_CALL:
      return 'critical';
    case ErrorClassification.MIDDLEWARE_ERROR:
    case ErrorClassification.MIDDLEWARE_TIMEOUT:
    case ErrorClassification.PARSE_ERROR:
      return 'high';
    case ErrorClassification.AUTHENTICATION_ERROR:
    case ErrorClassification.AUTHORIZATION_ERROR:
    case ErrorClassification.VALIDATION_ERROR:
    case ErrorClassification.RATE_LIMIT_ERROR:
    case ErrorClassification.TIMEOUT_ERROR:
    case ErrorClassification.NETWORK_ERROR:
      return 'medium';
    default:
      return 'low';
  }
}

function getErrorType(error: unknown): string {
  if (error instanceof RpcError) {
    return 'RpcError';
  }
  if (error instanceof MiddlewareError) {
    return 'MiddlewareError';
  }
  if (error instanceof MiddlewareTimeoutError) {
    return 'MiddlewareTimeoutError';
  }
  if (error instanceof ReentrantCallError) {
    return 'ReentrantCallError';
  }
  if (error instanceof Error) {
    return error.constructor.name;
  }
  if (error === null) {
    return 'null';
  }
  if (error === undefined) {
    return 'undefined';
  }
  return typeof error;
}

function createErrorMetadata(error: unknown, classification: ErrorClassificationResult, debugMode: boolean): ErrorMetadata {
  const metadata: ErrorMetadata = {
    classification: classification.classification,
    originalType: getErrorType(error),
    timestamp: Date.now(),
  };

  if (debugMode && classification.includeDebugInfo) {
    if (error instanceof MiddlewareError) {
      metadata.middlewareIndex = error.middlewareIndex;
    }
    if (error instanceof ReentrantCallError) {
      metadata.executionId = error.executionId;
    }
    if (error instanceof Error && error.stack) {
      metadata.stackTrace = error.stack;
    }
    if (error instanceof MiddlewareTimeoutError) {
      metadata.additionalData = {
        timeout: error.timeout,
        middlewareIndex: error.middlewareIndex,
      };
    }
  }

  return metadata;
}

function mapErrorToRpcError(error: unknown, ctx: RequestContext, options?: ErrorMapperOptions): ErrorMappingResult {
  if (options?.customErrorMapper) {
    try {
      return options.customErrorMapper(error, ctx);
    } catch (mapperError) {
      // Use stderr to avoid stdout pollution for stdio transport
      // biome-ignore lint/suspicious/noConsole: Error fallback logging to stderr
      console.error('Custom error mapper failed, falling back to default mapping:', mapperError);
    }
  }

  const classification = classifyError(error);
  const debugMode = isDebugMode(options);

  if (classification.preserveOriginalMessage) {
    return {
      code: classification.code,
      message: classification.message,
      data: error instanceof RpcError ? error.data : undefined,
    };
  }

  const result: ErrorMappingResult = {
    code: classification.code,
    message: classification.message,
  };

  if (debugMode && classification.includeDebugInfo) {
    const metadata = createErrorMetadata(error, classification, debugMode);
    result.data = {
      classification: classification.classification,
      severity: classification.severity,
      originalType: metadata.originalType,
      originalMessage: error instanceof Error ? error.message : String(error),
      timestamp: metadata.timestamp,
      ...(metadata.middlewareIndex !== undefined && { middlewareIndex: metadata.middlewareIndex }),
      ...(metadata.executionId !== undefined && { executionId: metadata.executionId }),
      ...(metadata.stackTrace !== undefined && options?.includeStackTrace && { stack: metadata.stackTrace }),
      ...(metadata.additionalData !== undefined && { additionalData: metadata.additionalData }),
    };
  }

  return result;
}

function logError(error: unknown, ctx: RequestContext, mappedError: ErrorMappingResult, options: ErrorMapperOptions): void {
  if (!options.enableLogging) {
    return;
  }

  const logLevel = options.logLevel || 'error';
  const debugMode = isDebugMode(options);
  const classification = classifyError(error);
  const metadata = createErrorMetadata(error, classification, debugMode);

  const logger = options.logger || new DefaultLogger();
  const logFormat = options.logFormat || 'json';

  const errorLogData = createErrorLogData(error, classification, mappedError);
  const requestContext = createRequestLogContext(ctx, metadata, options.includeRequestContext || false);
  const logMetadata = createLogMetadata();

  if (options.logFields?.traceId) {
    logMetadata.traceId = options.logFields.traceId as string;
  }
  if (options.logFields?.spanId) {
    logMetadata.spanId = options.logFields.spanId as string;
  }
  if (options.logFields?.correlationId) {
    logMetadata.correlationId = options.logFields.correlationId as string;
  }

  const logEntry: LogEntry = {
    timestamp: metadata.timestamp,
    level: logLevel,
    message: formatLogMessage(error, classification, logFormat),
    error: errorLogData,
    context: requestContext,
    metadata: {
      ...logMetadata,
      ...options.logFields?.customFields,
    },
    ...(debugMode && metadata.stackTrace && options.includeStackTrace && { stack: metadata.stackTrace }),
  };

  logger.log(logLevel, logEntry.message, logEntry);
}

function validateErrorMapperOptions(options: ErrorMapperOptions): void {
  if (options.logLevel && !['error', 'warn', 'info', 'debug'].includes(options.logLevel)) {
    throw new Error(`Invalid log level: ${options.logLevel}. Must be one of: error, warn, info, debug`);
  }

  if (options.logFormat && !['json', 'text'].includes(options.logFormat)) {
    throw new Error(`Invalid log format: ${options.logFormat}. Must be one of: json, text`);
  }

  if (options.customErrorMapper && typeof options.customErrorMapper !== 'function') {
    throw new Error('customErrorMapper must be a function');
  }

  if (options.onError && typeof options.onError !== 'function') {
    throw new Error('onError must be a function');
  }

  if (options.logger && typeof options.logger.log !== 'function') {
    throw new Error('logger must implement the Logger interface');
  }
}

function createDefaultOptions(): Required<
  Pick<ErrorMapperOptions, 'enableLogging' | 'logLevel' | 'logFormat' | 'includeStackTrace' | 'includeRequestContext'>
> {
  return {
    enableLogging: true,
    logLevel: 'error',
    logFormat: 'json',
    includeStackTrace: false,
    includeRequestContext: true,
  };
}

/**
 * Create error mapper middleware for comprehensive error handling and JSON-RPC error conversion.
 *
 * The error mapper middleware serves as the outermost safety net in the middleware stack,
 * catching all unhandled errors and converting them to proper JSON-RPC error responses.
 * It provides structured logging, debug mode support, and comprehensive error classification.
 *
 * @param options - Configuration options for error mapping behavior including logging, debug mode, and custom handlers
 * @returns Middleware function that handles error mapping
 *
 * @example Basic error mapper (recommended as outermost middleware)
 * ```typescript
 * const registry = new McpMiddlewareRegistry();
 *
 * // Register error mapper FIRST (outermost layer)
 * registry.registerMiddleware(createErrorMapperMiddleware());
 * registry.registerMiddleware(authMiddleware);
 * registry.registerMiddleware(businessLogicMiddleware);
 * ```
 *
 * @example Error mapper with custom configuration
 * ```typescript
 * const errorMapper = createErrorMapperMiddleware({
 *   enableLogging: true,
 *   logLevel: 'warn',
 *   logFormat: 'console',
 *   includeStackTrace: true,
 *   includeRequestContext: true,
 *   debugMode: process.env.NODE_ENV === 'development'
 * });
 *
 * registry.registerMiddleware(errorMapper);
 * ```
 *
 * @example Error mapper with custom logger
 * ```typescript
 * const customLogger = {
 *   error: (message, meta) => winston.error(message, meta),
 *   warn: (message, meta) => winston.warn(message, meta),
 *   info: (message, meta) => winston.info(message, meta),
 *   debug: (message, meta) => winston.debug(message, meta),
 *   log: (level, message, meta) => winston.log(level, message, meta)
 * };
 *
 * const errorMapper = createErrorMapperMiddleware({
 *   logger: customLogger,
 *   enableLogging: true,
 *   logFormat: 'json'
 * });
 * ```
 *
 * @example Error mapper with custom classification
 * ```typescript
 * const customClassifier = (error: Error): ErrorClassificationResult => {
 *   if (error.message.includes('timeout')) {
 *     return {
 *       classification: ErrorClassification.TIMEOUT,
 *       jsonRpcCode: -32603,
 *       message: 'Request timeout',
 *       shouldLog: true,
 *       logLevel: 'warn'
 *     };
 *   }
 *   return classifyError(error); // Fall back to default
 * };
 *
 * const errorMapper = createErrorMapperMiddleware({
 *   errorClassifier: customClassifier
 * });
 * ```
 *
 * @example Debug mode configuration
 * ```typescript
 * // Enable debug mode via environment variable
 * process.env.MCPKIT_DEBUG = '1';
 *
 * const errorMapper = createErrorMapperMiddleware({
 *   debugMode: true, // Or omit to use MCPKIT_DEBUG env var
 *   includeStackTrace: true,
 *   logLevel: 'debug'
 * });
 *
 * // In debug mode, errors include additional context:
 * // - Full stack traces
 * // - Request details
 * // - Middleware execution context
 * // - Performance timing
 * ```
 */
export function createErrorMapperMiddleware(options: ErrorMapperOptions = {}): Middleware {
  validateErrorMapperOptions(options);

  const defaultOptions = createDefaultOptions();
  const mergedOptions: ErrorMapperOptions = {
    ...defaultOptions,
    ...options,
  };

  const middleware: Middleware = async (ctx: RequestContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      const mappedError = mapErrorToRpcError(error, ctx, mergedOptions);

      const rpcError = new RpcError(mappedError.code, mappedError.message, mappedError.data);
      ctx.response = encodeJsonRpcError(ctx.request.id, rpcError);

      if (mergedOptions.enableLogging) {
        logError(error, ctx, mappedError, mergedOptions);
      }

      if (mergedOptions.onError) {
        try {
          mergedOptions.onError(error, ctx, mappedError);
        } catch (hookError) {
          // Use stderr to avoid stdout pollution for stdio transport
          // biome-ignore lint/suspicious/noConsole: Error hook failure logging to stderr
          console.error('Error in onError hook:', hookError);
        }
      }
    }
  };

  Object.defineProperty(middleware, 'name', { value: 'ErrorMapperMiddleware' });
  return middleware;
}

/**
 * Create error mapper middleware with sensible default configuration.
 *
 * This is a convenience function that creates an error mapper middleware with
 * production-ready defaults. It enables logging, uses error log level, includes
 * request context, and respects the MCPKIT_DEBUG environment variable for debug mode.
 *
 * @returns Middleware function with default error mapping configuration
 *
 * @example Using default error mapper
 * ```typescript
 * const registry = new McpMiddlewareRegistry();
 *
 * // Quick setup with sensible defaults
 * registry.registerMiddleware(createErrorMapperMiddlewareWithDefaults());
 * registry.registerMiddleware(otherMiddleware);
 * ```
 *
 * @example Equivalent manual configuration
 * ```typescript
 * // This is equivalent to createErrorMapperMiddlewareWithDefaults()
 * const errorMapper = createErrorMapperMiddleware({
 *   enableLogging: true,
 *   logLevel: 'error',
 *   includeRequestContext: true,
 *   includeStackTrace: false,
 *   debugMode: process.env.MCPKIT_DEBUG === '1'
 * });
 * ```
 */
export function createErrorMapperMiddlewareWithDefaults(): Middleware {
  return createErrorMapperMiddleware({
    enableLogging: true,
    logLevel: 'error',
    includeRequestContext: true,
    includeStackTrace: false,
    debugMode: isDebugMode(),
  });
}
