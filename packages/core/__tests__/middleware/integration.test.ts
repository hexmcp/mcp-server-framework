import { encodeJsonRpcError, encodeJsonRpcSuccess, RpcError } from '@hexmcp/codec-jsonrpc';

import { McpCapabilityRegistry, McpLifecycleManager, McpRequestGate, MockPrimitiveRegistry } from '../../src/lifecycle/index';
import { McpMiddlewareEngine, McpMiddlewareRegistry } from '../../src/middleware/index';
import {
  OPERATIONAL_REQUESTS,
  performCompleteLifecycleInitialization,
  VALID_INITIALIZE_REQUEST_WITH_ID,
} from '../fixtures/handshake-fixtures';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createMockRequestContext,
  createRateLimitMiddleware,
  createStateMutationMiddleware,
  createTracingMiddleware,
  SAMPLE_SUCCESS_RESPONSE,
} from '../fixtures/middleware-fixtures';

describe('Middleware Integration', () => {
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let middlewareRegistry: McpMiddlewareRegistry;
  let middlewareEngine: McpMiddlewareEngine;
  let capabilityRegistry: McpCapabilityRegistry;

  beforeEach(() => {
    const primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
    middlewareRegistry = new McpMiddlewareRegistry();
    middlewareEngine = new McpMiddlewareEngine();
  });

  describe('lifecycle integration', () => {
    it('should integrate middleware with request gating', async () => {
      const logs: string[] = [];

      middlewareRegistry.registerMiddleware(createLoggingMiddleware('auth', logs));
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('validation', logs));

      const ctx = createMockRequestContext({
        request: OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' },
      });

      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockNext = jest.fn().mockImplementation(() => {
        if (!requestGate.canProcessRequest(ctx.request.method)) {
          const error = requestGate.getValidationError(ctx.request.method);
          if (error) {
            ctx.response = encodeJsonRpcError((ctx.request as any).id, new RpcError(error.code, error.message));
          }
        }
      });

      await composedMiddleware(ctx, mockNext);

      expect(logs).toEqual(['auth:before', 'validation:before', 'validation:after', 'auth:after']);
      expect(ctx.response).toBeDefined();
      expect((ctx.response as any).error.code).toBe(-32002);
    });

    it('should allow middleware to process requests after initialization', async () => {
      await performCompleteLifecycleInitialization(lifecycleManager);

      const logs: string[] = [];
      middlewareRegistry.registerMiddleware(createTracingMiddleware('tracing'));
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('business', logs));

      const ctx = createMockRequestContext({
        request: OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' },
      });

      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockNext = jest.fn().mockImplementation(() => {
        if (requestGate.canProcessRequest(ctx.request.method)) {
          ctx.response = SAMPLE_SUCCESS_RESPONSE;
        }
      });

      await composedMiddleware(ctx, mockNext);

      expect(logs).toEqual(['business:before', 'business:after']);
      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.response).toEqual(SAMPLE_SUCCESS_RESPONSE);
    });
  });

  describe('transport integration simulation', () => {
    it('should simulate full request processing pipeline', async () => {
      await performCompleteLifecycleInitialization(lifecycleManager);

      middlewareRegistry.registerMiddleware(createTracingMiddleware('tracing'));
      middlewareRegistry.registerMiddleware(createAuthMiddleware('auth', true));
      middlewareRegistry.registerMiddleware(createRateLimitMiddleware('rate-limit', 10));
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('business', 'processed', true));

      const ctx = createMockRequestContext({
        request: OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' },
        transport: {
          name: 'stdio',
          peer: { ip: '127.0.0.1' },
        },
      });

      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockDispatcher = jest.fn().mockImplementation(() => {
        if (requestGate.canProcessRequest(ctx.request.method)) {
          ctx.response = encodeJsonRpcSuccess((ctx.request as any).id, {
            tools: [{ name: 'test-tool', description: 'A test tool' }],
          });
        }
      });

      await composedMiddleware(ctx, mockDispatcher);

      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.state.authenticated).toBe(true);
      expect(ctx.state.user).toEqual({ id: 'test-user', name: 'Test User' });
      expect(ctx.state.requestCount).toBe(1);
      expect(ctx.state.processed).toBe(true);
      expect(ctx.response).toBeDefined();
      expect((ctx.response as any).result.tools).toHaveLength(1);
    });

    it('should handle authentication failure in pipeline', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      middlewareRegistry.registerMiddleware(createTracingMiddleware('tracing'));
      middlewareRegistry.registerMiddleware(createAuthMiddleware('auth', false));
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('business', 'processed', true));

      const ctx = createMockRequestContext({
        request: OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' },
      });

      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockDispatcher = jest.fn();

      await composedMiddleware(ctx, mockDispatcher);

      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.state.authenticated).toBeUndefined();
      expect(ctx.state.processed).toBeUndefined();
      expect(ctx.response).toBeDefined();
      expect((ctx.response as any).error.code).toBe(-32000);
      expect((ctx.response as any).error.message).toBe('Authentication failed');
      expect(mockDispatcher).not.toHaveBeenCalled();
    });

    it.skip('should handle rate limiting in pipeline', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const rateLimitMiddleware = createRateLimitMiddleware('rate-limit', 2);
      middlewareRegistry.registerMiddleware(rateLimitMiddleware);
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('business', 'processed', true));

      const mockDispatcher = jest.fn().mockImplementation((ctx) => {
        if (ctx && !ctx.response) {
          ctx.response = SAMPLE_SUCCESS_RESPONSE;
        }
      });

      const baseRequest = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' };

      // First request - should succeed
      const ctx1 = createMockRequestContext({
        request: { ...baseRequest, id: 'request-0' },
      });
      const middlewareStack1 = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware1 = middlewareEngine.applyMiddleware(middlewareStack1);
      await composedMiddleware1(ctx1, mockDispatcher);

      expect(ctx1.state.processed).toBe(true);
      expect(ctx1.state.requestCount).toBe(1);
      expect(ctx1.response).toBeDefined();

      // Second request - should succeed
      const ctx2 = createMockRequestContext({
        request: { ...baseRequest, id: 'request-1' },
      });
      const middlewareStack2 = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware2 = middlewareEngine.applyMiddleware(middlewareStack2);
      await composedMiddleware2(ctx2, mockDispatcher);

      expect(ctx2.state.processed).toBe(true);
      expect(ctx2.state.requestCount).toBe(2);
      expect(ctx2.response).toBeDefined();

      // Third request - should be rate limited
      const ctx3 = createMockRequestContext({
        request: { ...baseRequest, id: 'request-2' },
      });
      const middlewareStack3 = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware3 = middlewareEngine.applyMiddleware(middlewareStack3);
      await composedMiddleware3(ctx3, mockDispatcher);

      expect(ctx3.state.processed).toBeUndefined();
      expect(ctx3.state.requestCount).toBeUndefined();
      expect(ctx3.response).toBeDefined();
      expect((ctx3.response as any).error.message).toBe('Rate limit exceeded');
    });
  });

  describe('error handling integration', () => {
    it('should handle middleware errors with lifecycle context', async () => {
      const errorMiddleware = async () => {
        throw new Error('Middleware processing failed');
      };

      middlewareRegistry.registerMiddleware(createTracingMiddleware('tracing'));
      middlewareRegistry.registerMiddleware(errorMiddleware);
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('business', 'processed', true));

      const ctx = createMockRequestContext();
      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockDispatcher = jest.fn();

      await expect(composedMiddleware(ctx, mockDispatcher)).rejects.toThrow('Middleware at index 1 failed');

      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.state.processed).toBeUndefined();
      expect(mockDispatcher).not.toHaveBeenCalled();
    });

    it('should handle lifecycle violations through middleware', async () => {
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('pre-check', []));

      const ctx = createMockRequestContext({
        request: OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0' as const, method: 'prompts/list', id: 'test-prompts-1' },
      });

      const middlewareStack = middlewareRegistry.getMiddlewareStack();
      const composedMiddleware = middlewareEngine.applyMiddleware(middlewareStack);

      const mockDispatcher = jest.fn().mockImplementation(() => {
        try {
          requestGate.validateRequest(ctx.request.method);
        } catch {
          const validationError = requestGate.getValidationError(ctx.request.method);
          if (validationError) {
            ctx.response = encodeJsonRpcError((ctx.request as any).id, new RpcError(validationError.code, validationError.message));
          }
        }
      });

      await composedMiddleware(ctx, mockDispatcher);

      expect(ctx.response).toBeDefined();
      expect((ctx.response as any).error.code).toBe(-32002);
    });
  });
});
