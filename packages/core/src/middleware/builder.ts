import type { JsonRpcRequest } from '@hexmcp/codec-jsonrpc';
import { createErrorMapperMiddleware } from './error-mapper';
import { createBuiltInLoggingMiddleware } from './logger';
import type { LogLevel, Middleware, MiddlewareRegistry } from './types';

export interface MiddlewareBuilder {
  use(middleware: Middleware): this;
  use(middleware: Middleware[]): this;
  use(...middleware: Middleware[]): this;
  getMiddlewareRegistry(): MiddlewareRegistry;
}

export class McpMiddlewareBuilder implements MiddlewareBuilder {
  private readonly _middlewareRegistry: MiddlewareRegistry;

  constructor(middlewareRegistry: MiddlewareRegistry) {
    this._middlewareRegistry = middlewareRegistry;
  }

  use(middleware: Middleware): this;
  use(middleware: Middleware[]): this;
  use(...middleware: Middleware[]): this;
  use(middlewareOrArray: Middleware | Middleware[], ...additionalMiddleware: Middleware[]): this {
    if (Array.isArray(middlewareOrArray)) {
      for (const mw of middlewareOrArray) {
        this._middlewareRegistry.registerMiddleware(mw);
      }
    } else {
      this._middlewareRegistry.registerMiddleware(middlewareOrArray);
    }

    for (const mw of additionalMiddleware) {
      this._middlewareRegistry.registerMiddleware(mw);
    }

    return this;
  }

  getMiddlewareRegistry(): MiddlewareRegistry {
    return this._middlewareRegistry;
  }

  clear(): this {
    this._middlewareRegistry.clear();
    return this;
  }

  size(): number {
    return this._middlewareRegistry.size();
  }

  isEmpty(): boolean {
    return this._middlewareRegistry.isEmpty();
  }
}

export function createMiddlewareBuilder(middlewareRegistry: MiddlewareRegistry): MiddlewareBuilder {
  return new McpMiddlewareBuilder(middlewareRegistry);
}

export interface ServerBuilderWithMiddleware {
  use(middleware: Middleware): this;
  use(middleware: Middleware[]): this;
  use(...middleware: Middleware[]): this;
}

export function addMiddlewareSupport<T extends object>(
  builder: T,
  middlewareRegistry: MiddlewareRegistry
): T & ServerBuilderWithMiddleware {
  const middlewareBuilder = new McpMiddlewareBuilder(middlewareRegistry);

  return Object.assign(builder, {
    use: middlewareBuilder.use.bind(middlewareBuilder),
  });
}

export interface BuiltInMiddleware {
  errorMapper(options?: ErrorMapperMiddlewareOptions): Middleware;
  logging(options?: LoggingMiddlewareOptions): Middleware;
  auth(options: AuthMiddlewareOptions): Middleware;
  rateLimit(options: RateLimitMiddlewareOptions): Middleware;
  tracing(options?: TracingMiddlewareOptions): Middleware;
  cors(options?: CorsMiddlewareOptions): Middleware;
  timeout(options: TimeoutMiddlewareOptions): Middleware;
}

export interface LoggingMiddlewareOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeRequest?: boolean;
  includeResponse?: boolean;
  includeMetadata?: boolean;
  logger?: (level: string, message: string, data?: unknown) => void;
}

export interface AuthMiddlewareOptions {
  authenticate: (ctx: {
    request: JsonRpcRequest;
    transport: { name: string; peer?: unknown };
    state: Record<string, unknown>;
  }) => Promise<boolean | { user: unknown }>;
  onAuthFailure?: (ctx: {
    request: JsonRpcRequest;
    transport: { name: string; peer?: unknown };
    state: Record<string, unknown>;
  }) => unknown;
}

export interface RateLimitMiddlewareOptions {
  maxRequests: number;
  windowMs?: number;
  keyGenerator?: (ctx: { request: JsonRpcRequest; transport: { name: string; peer?: unknown } }) => string;
  onLimitExceeded?: (ctx: {
    request: JsonRpcRequest;
    transport: { name: string; peer?: unknown };
    state: Record<string, unknown>;
  }) => unknown;
}

export interface TracingMiddlewareOptions {
  generateTraceId?: () => string;
  includeMetrics?: boolean;
  onTraceComplete?: (trace: { traceId: string; duration: number; success: boolean }) => void;
}

export interface CorsMiddlewareOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

export interface TimeoutMiddlewareOptions {
  timeoutMs: number;
  onTimeout?: (ctx: { request: JsonRpcRequest; transport: { name: string; peer?: unknown }; state: Record<string, unknown> }) => unknown;
}

export interface ErrorMapperMiddlewareOptions {
  debugMode?: boolean;
  enableLogging?: boolean;
  logLevel?: LogLevel;
  customErrorMapper?: (
    error: unknown,
    ctx: { request: JsonRpcRequest; transport: { name: string; peer?: unknown }; state: Record<string, unknown> }
  ) => { code: number; message: string; data?: unknown };
  includeStackTrace?: boolean;
  includeRequestContext?: boolean;
  logFormat?: 'json' | 'text';
  onError?: (
    error: unknown,
    ctx: { request: JsonRpcRequest; transport: { name: string; peer?: unknown }; state: Record<string, unknown> },
    mappedError: { code: number; message: string; data?: unknown }
  ) => void;
}

export function createBuiltInErrorMapperMiddleware(options?: ErrorMapperMiddlewareOptions): Middleware {
  return createErrorMapperMiddleware(options);
}

/**
 * Create a collection of built-in middleware factories for common use cases.
 *
 * This function returns an object containing factory functions for all built-in
 * middleware provided by the MCP server framework. These middleware implementations
 * cover common concerns like error handling, logging, authentication, rate limiting,
 * and more. Some middleware are fully implemented while others are placeholders
 * for future implementation.
 *
 * @returns Object containing factory functions for built-in middleware
 *
 * @example Using built-in middleware
 * ```typescript
 * const builtIn = createBuiltInMiddleware();
 * const registry = new McpMiddlewareRegistry();
 *
 * // Register built-in middleware
 * registry.registerMiddleware(builtIn.errorMapper({
 *   enableLogging: true,
 *   debugMode: true
 * }));
 *
 * registry.registerMiddleware(builtIn.logging({
 *   logLevel: 'info',
 *   includeRequestBody: false
 * }));
 *
 * // Note: Some middleware are not yet implemented
 * try {
 *   registry.registerMiddleware(builtIn.auth({ strategy: 'bearer' }));
 * } catch (error) {
 *   console.log('Auth middleware not yet implemented');
 * }
 * ```
 *
 * @example Builder pattern integration
 * ```typescript
 * const builder = createMcpKitServer()
 *   .use(builtIn.errorMapper())
 *   .use(builtIn.logging({ logLevel: 'debug' }))
 *   .tool('echo', echoToolDefinition)
 *   .transport(stdioTransport);
 * ```
 *
 * @example Custom middleware alongside built-in
 * ```typescript
 * const builtIn = createBuiltInMiddleware();
 *
 * const customMiddleware: Middleware = async (ctx, next) => {
 *   // Custom logic
 *   await next();
 * };
 *
 * registry.registerMiddleware(builtIn.errorMapper());
 * registry.registerMiddleware(customMiddleware);
 * registry.registerMiddleware(builtIn.logging());
 * ```
 */
export function createBuiltInMiddleware(): BuiltInMiddleware {
  return {
    errorMapper: (options?: ErrorMapperMiddlewareOptions) => createBuiltInErrorMapperMiddleware(options),
    logging: (options?: LoggingMiddlewareOptions) => createBuiltInLoggingMiddleware(options),
    auth: (_options: AuthMiddlewareOptions) => {
      throw new Error('Auth middleware not yet implemented');
    },
    rateLimit: (_options: RateLimitMiddlewareOptions) => {
      throw new Error('Rate limit middleware not yet implemented');
    },
    tracing: (_options?: TracingMiddlewareOptions) => {
      throw new Error('Tracing middleware not yet implemented');
    },
    cors: (_options?: CorsMiddlewareOptions) => {
      throw new Error('CORS middleware not yet implemented');
    },
    timeout: (_options: TimeoutMiddlewareOptions) => {
      throw new Error('Timeout middleware not yet implemented');
    },
  };
}

export function addBuiltInMiddlewareSupport<T extends object>(
  builder: T,
  middlewareRegistry: MiddlewareRegistry
): T & ServerBuilderWithMiddleware & { builtIn: BuiltInMiddleware } {
  const middlewareBuilder = new McpMiddlewareBuilder(middlewareRegistry);
  const builtInMiddleware = createBuiltInMiddleware();

  return Object.assign(builder, {
    use: middlewareBuilder.use.bind(middlewareBuilder),
    builtIn: builtInMiddleware,
  });
}
