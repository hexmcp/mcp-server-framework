import { encodeJsonRpcError, encodeJsonRpcSuccess, type JsonRpcRequest, type JsonRpcResponse, RpcError } from '@hexmcp/codec-jsonrpc';
import type { Middleware, RequestContext } from '../../src/middleware/types.js';

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
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
