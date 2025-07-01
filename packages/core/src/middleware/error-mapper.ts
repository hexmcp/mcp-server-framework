import { encodeJsonRpcError, JSON_RPC_ERROR_CODES, RpcError } from '@hexmcp/codec-jsonrpc';
import type { ErrorClassificationResult, ErrorMapperOptions, ErrorMappingResult, ErrorMetadata, Middleware, RequestContext } from './types';
import { ErrorClassification, MiddlewareError, MiddlewareTimeoutError, ReentrantCallError } from './types';

function isDebugMode(options?: ErrorMapperOptions): boolean {
  if (options?.debugMode !== undefined) {
    return options.debugMode;
  }
  return process.env.MCPKIT_DEBUG === '1';
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
      // biome-ignore lint/suspicious/noConsole: Error fallback logging
      console.warn('Custom error mapper failed, falling back to default mapping:', mapperError);
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

  const logEntry = {
    level: logLevel,
    message: 'Middleware error caught by error mapper',
    error: {
      classification: classification.classification,
      severity: classification.severity,
      type: metadata.originalType,
      code: mappedError.code,
      message: mappedError.message,
      originalMessage: error instanceof Error ? error.message : String(error),
      data: mappedError.data,
    },
    context: options.includeRequestContext
      ? {
          requestId: ctx.request.id,
          method: ctx.request.method,
          transport: ctx.transport.name,
          timestamp: metadata.timestamp,
          ...(metadata.middlewareIndex !== undefined && { middlewareIndex: metadata.middlewareIndex }),
          ...(metadata.executionId !== undefined && { executionId: metadata.executionId }),
        }
      : undefined,
    stack: debugMode && metadata.stackTrace ? metadata.stackTrace : undefined,
  };

  // biome-ignore lint/suspicious/noConsole: Structured logging output for error mapper
  console.log(JSON.stringify(logEntry, null, 2));
}

export function createErrorMapperMiddleware(options: ErrorMapperOptions = {}): Middleware {
  const middleware: Middleware = async (ctx: RequestContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      const mappedError = mapErrorToRpcError(error, ctx, options);

      const rpcError = new RpcError(mappedError.code, mappedError.message, mappedError.data);
      ctx.response = encodeJsonRpcError(ctx.request.id, rpcError);

      if (options.enableLogging) {
        logError(error, ctx, mappedError, options);
      }

      if (options.onError) {
        try {
          options.onError(error, ctx, mappedError);
        } catch (hookError) {
          // biome-ignore lint/suspicious/noConsole: Error hook failure logging
          console.warn('Error in onError hook:', hookError);
        }
      }
    }
  };

  Object.defineProperty(middleware, 'name', { value: 'ErrorMapperMiddleware' });
  return middleware;
}
