import {
  encodeJsonRpcError,
  encodeJsonRpcSuccess,
  JSON_RPC_ERROR_CODES,
  type JsonRpcRequest,
  type JsonRpcResponse,
  RpcError,
} from '@hexmcp/codec-jsonrpc';
import {
  createErrorMapperMiddleware,
  type ErrorMapperOptions,
  type LogEntry,
  type Logger,
  MiddlewareError,
  MiddlewareTimeoutError,
  ReentrantCallError,
} from '../../src/middleware/index';
import type { Middleware, RequestContext } from '../../src/middleware/types';

export const SAMPLE_JSON_RPC_REQUEST: JsonRpcRequest = {
  jsonrpc: '2.0',
  id: 'test-request-1',
  method: 'tools/list',
  params: {},
};

export const SAMPLE_JSON_RPC_NOTIFICATION: JsonRpcRequest = {
  jsonrpc: '2.0',
  id: null,
  method: 'notifications/progress',
  params: { progressToken: 'test-token', progress: 0.5 },
};

export const SAMPLE_SUCCESS_RESPONSE: JsonRpcResponse = encodeJsonRpcSuccess('test-request-1', {
  tools: [{ name: 'test-tool', description: 'A test tool' }],
});

export const SAMPLE_ERROR_RESPONSE: JsonRpcResponse = encodeJsonRpcError('test-request-1', new RpcError(-32601, 'Method not found'));

export function createMockRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const mockSend = jest.fn().mockResolvedValue(undefined);

  return {
    request: SAMPLE_JSON_RPC_REQUEST,
    send: mockSend,
    transport: {
      name: 'test-transport',
      peer: { ip: '127.0.0.1' },
    },
    state: {},
    ...overrides,
  };
}

export function createLoggingMiddleware(name: string, logs: string[]): Middleware {
  const middleware: Middleware = async (_ctx, next) => {
    logs.push(`${name}:before`);
    await next();
    logs.push(`${name}:after`);
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createErrorMiddleware(name: string, error: Error): Middleware {
  const middleware: Middleware = async (_ctx, _next) => {
    throw error;
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createShortCircuitMiddleware(name: string, response: JsonRpcResponse): Middleware {
  const middleware: Middleware = async (ctx, _next) => {
    ctx.response = response;
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createDelayMiddleware(name: string, delayMs: number): Middleware {
  const middleware: Middleware = async (_ctx, next) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await next();
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createStateMutationMiddleware(name: string, key: string, value: unknown): Middleware {
  const middleware: Middleware = async (ctx, next) => {
    ctx.state[key] = value;
    await next();
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createAuthMiddleware(name: string, shouldAuthenticate: boolean): Middleware {
  const middleware: Middleware = async (ctx, next) => {
    if (!shouldAuthenticate) {
      const request = ctx.request as JsonRpcRequest;
      ctx.response = encodeJsonRpcError(request.id, new RpcError(-32000, 'Authentication failed'));
      return;
    }

    ctx.state.authenticated = true;
    ctx.state.user = { id: 'test-user', name: 'Test User' };
    await next();
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createRateLimitMiddleware(name: string, maxRequests: number): Middleware {
  let requestCount = 0;

  const middleware: Middleware = async (ctx, next) => {
    requestCount++;

    if (requestCount > maxRequests) {
      const request = ctx.request as JsonRpcRequest;
      ctx.response = encodeJsonRpcError(request.id, new RpcError(-32000, 'Rate limit exceeded'));
      return;
    }

    ctx.state.requestCount = requestCount;
    await next();
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createTracingMiddleware(name: string): Middleware {
  const middleware: Middleware = async (ctx, next) => {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    ctx.state.traceId = traceId;
    ctx.state.startTime = Date.now();

    try {
      await next();
    } finally {
      ctx.state.endTime = Date.now();
      ctx.state.duration = (ctx.state.endTime as number) - (ctx.state.startTime as number);
    }
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export function createReentrantCallMiddleware(name: string): Middleware {
  const middleware: Middleware = async (_ctx, next) => {
    await next();
    await next();
  };

  Object.defineProperty(middleware, 'name', { value: name });
  return middleware;
}

export const MIDDLEWARE_TEST_SCENARIOS = {
  SIMPLE_EXECUTION: 'simple-execution',
  ERROR_PROPAGATION: 'error-propagation',
  SHORT_CIRCUIT: 'short-circuit',
  STATE_MUTATION: 'state-mutation',
  AUTHENTICATION: 'authentication',
  RATE_LIMITING: 'rate-limiting',
  TRACING: 'tracing',
  REENTRANT_CALL: 'reentrant-call',
} as const;

export type MiddlewareTestScenario = (typeof MIDDLEWARE_TEST_SCENARIOS)[keyof typeof MIDDLEWARE_TEST_SCENARIOS];

export class MockLogger implements Logger {
  public logs: Array<{ level: string; message: string; meta?: LogEntry }> = [];

  error(message: string, meta?: LogEntry): void {
    this.logs.push({ level: 'error', message, ...(meta && { meta }) });
  }

  warn(message: string, meta?: LogEntry): void {
    this.logs.push({ level: 'warn', message, ...(meta && { meta }) });
  }

  info(message: string, meta?: LogEntry): void {
    this.logs.push({ level: 'info', message, ...(meta && { meta }) });
  }

  debug(message: string, meta?: LogEntry): void {
    this.logs.push({ level: 'debug', message, ...(meta && { meta }) });
  }

  log(level: string, message: string, meta?: LogEntry): void {
    this.logs.push({ level, message, ...(meta && { meta }) });
  }

  clear(): void {
    this.logs = [];
  }

  getLastLog(): { level: string; message: string; meta?: LogEntry } | undefined {
    return this.logs[this.logs.length - 1];
  }

  getLogsByLevel(level: string): Array<{ level: string; message: string; meta?: LogEntry }> {
    return this.logs.filter((log) => log.level === level);
  }
}

export function createMockErrorMapperMiddleware(options: Partial<ErrorMapperOptions> = {}): Middleware {
  const defaultOptions: ErrorMapperOptions = {
    enableLogging: false,
    logLevel: 'error',
    includeStackTrace: false,
    includeRequestContext: false,
    debugMode: false,
    ...options,
  };

  return createErrorMapperMiddleware(defaultOptions);
}

export function createErrorMapperWithMockLogger(options: Partial<ErrorMapperOptions> = {}): { middleware: Middleware; logger: MockLogger } {
  const logger = new MockLogger();
  const middleware = createErrorMapperMiddleware({
    enableLogging: true,
    logger,
    ...options,
  });

  return { middleware, logger };
}

export const SAMPLE_ERROR_SCENARIOS = {
  STANDARD_ERROR: () => new Error('Standard error message'),
  RPC_ERROR: () => new RpcError(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, 'Method not found', { method: 'test/method' }),
  MIDDLEWARE_ERROR: () => new MiddlewareError('Middleware execution failed', 2),
  MIDDLEWARE_TIMEOUT: () => new MiddlewareTimeoutError(5000, 1),
  REENTRANT_CALL: () => new ReentrantCallError('exec-123'),
  VALIDATION_ERROR: () => new Error('Validation failed for parameter'),
  AUTH_ERROR: () => new Error('Authentication failed'),
  RATE_LIMIT_ERROR: () => new Error('Rate limit exceeded'),
  TIMEOUT_ERROR: () => new Error('Request timeout'),
  NETWORK_ERROR: () => new Error('Network connection failed'),
  PARSE_ERROR: () => new Error('JSON parse error'),
  NULL_ERROR: () => null,
  UNDEFINED_ERROR: () => undefined,
  STRING_ERROR: () => 'String error message',
  CIRCULAR_ERROR: () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test fixture for circular reference handling
    const obj: any = { name: 'circular' };
    obj.self = obj;
    const error = new Error('Circular reference error');
    // biome-ignore lint/suspicious/noExplicitAny: Test fixture for circular reference handling
    (error as any).circular = obj;
    return error;
  },
  LONG_MESSAGE_ERROR: () => new Error('A'.repeat(1000)),
  NO_MESSAGE_ERROR: () => new Error(),
} as const;

export type ErrorScenarioKey = keyof typeof SAMPLE_ERROR_SCENARIOS;

export function createErrorScenario(key: ErrorScenarioKey): unknown {
  return SAMPLE_ERROR_SCENARIOS[key]();
}

export const ERROR_MAPPER_TEST_OPTIONS = {
  DEBUG_MODE: {
    debugMode: true,
    includeStackTrace: true,
    includeRequestContext: true,
    enableLogging: true,
  },
  PRODUCTION_MODE: {
    debugMode: false,
    includeStackTrace: false,
    includeRequestContext: false,
    enableLogging: false,
  },
  LOGGING_ENABLED: {
    enableLogging: true,
    logLevel: 'error' as const,
    includeRequestContext: true,
  },
  CUSTOM_MAPPER: {
    customErrorMapper: (error: unknown) => ({
      code: -32000,
      message: 'Custom mapped error',
      data: { originalError: error instanceof Error ? error.message : String(error) },
    }),
  },
  WITH_HOOKS: {
    onError: jest.fn(),
  },
} as const;

export function createErrorMapperTestSuite(
  name: string,
  options: ErrorMapperOptions = {}
): {
  name: string;
  middleware: Middleware;
  logger: MockLogger;
  options: ErrorMapperOptions;
} {
  const logger = new MockLogger();
  const mergedOptions = {
    enableLogging: true,
    logger,
    ...options,
  };

  const middleware = createErrorMapperMiddleware(mergedOptions);

  return {
    name,
    middleware,
    logger,
    options: mergedOptions,
  };
}
