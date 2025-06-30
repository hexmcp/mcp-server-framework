import type { JsonRpcRequest } from '@hexmcp/codec-jsonrpc';
import type { Middleware, MiddlewareRegistry } from './types';

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
