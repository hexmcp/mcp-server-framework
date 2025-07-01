import { encodeJsonRpcError, RpcError } from '@hexmcp/codec-jsonrpc';
import type { ErrorMapperOptions, ErrorMappingResult, Middleware, RequestContext } from './types';
import { MiddlewareError, MiddlewareTimeoutError, ReentrantCallError } from './types';

function isDebugMode(options?: ErrorMapperOptions): boolean {
  if (options?.debugMode !== undefined) {
    return options.debugMode;
  }
  return process.env.MCPKIT_DEBUG === '1';
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

function mapErrorToRpcError(error: unknown, ctx: RequestContext, options?: ErrorMapperOptions): ErrorMappingResult {
  if (options?.customErrorMapper) {
    try {
      return options.customErrorMapper(error, ctx);
    } catch (mapperError) {
      // biome-ignore lint/suspicious/noConsole: Error fallback logging
      console.warn('Custom error mapper failed, falling back to default mapping:', mapperError);
    }
  }

  if (error instanceof RpcError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  if (error instanceof MiddlewareError || error instanceof MiddlewareTimeoutError || error instanceof ReentrantCallError) {
    const debugMode = isDebugMode(options);
    return {
      code: -32603,
      message: 'Internal error',
      data: debugMode
        ? {
            type: getErrorType(error),
            originalMessage: error.message,
            middlewareIndex: 'middlewareIndex' in error ? error.middlewareIndex : undefined,
            executionId: 'executionId' in error ? error.executionId : undefined,
          }
        : undefined,
    };
  }

  if (error instanceof Error) {
    const debugMode = isDebugMode(options);
    return {
      code: -32603,
      message: 'Internal error',
      data: debugMode
        ? {
            type: getErrorType(error),
            originalMessage: error.message,
            stack: options?.includeStackTrace ? error.stack : undefined,
          }
        : undefined,
    };
  }

  return {
    code: -32603,
    message: 'Internal error',
    data: isDebugMode(options)
      ? {
          type: getErrorType(error),
          originalError: error,
        }
      : undefined,
  };
}

function logError(error: unknown, ctx: RequestContext, mappedError: ErrorMappingResult, options: ErrorMapperOptions): void {
  if (!options.enableLogging) {
    return;
  }

  const logLevel = options.logLevel || 'error';
  const debugMode = isDebugMode(options);

  const logEntry = {
    level: logLevel,
    message: 'Middleware error caught by error mapper',
    error: {
      type: getErrorType(error),
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
          timestamp: Date.now(),
        }
      : undefined,
    stack: debugMode && error instanceof Error ? error.stack : undefined,
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
