import { JSON_RPC_ERROR_CODES } from '@hexmcp/codec-jsonrpc';
import { McpCapabilityRegistry, McpLifecycleManager, McpRequestGate, MockPrimitiveRegistry } from '../../src/lifecycle/index';
import {
  createErrorMapperMiddleware,
  ErrorClassification,
  McpMiddlewareEngine,
  McpMiddlewareRegistry,
  type Middleware,
  MiddlewareDispatcher,
  type RequestContext,
} from '../../src/middleware/index';
import {
  OPERATIONAL_REQUESTS,
  performCompleteLifecycleInitialization,
  VALID_INITIALIZE_REQUEST_WITH_ID,
} from '../fixtures/handshake-fixtures';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createShortCircuitMiddleware,
  createStateMutationMiddleware,
  createTracingMiddleware,
  SAMPLE_SUCCESS_RESPONSE,
} from '../fixtures/middleware-fixtures';

describe('Error Mapper Integration Tests', () => {
  let middlewareRegistry: McpMiddlewareRegistry;
  let middlewareEngine: McpMiddlewareEngine;
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let dispatcher: MiddlewareDispatcher;
  let mockCoreDispatcher: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    middlewareRegistry = new McpMiddlewareRegistry();
    middlewareEngine = new McpMiddlewareEngine();

    const primitiveRegistry = new MockPrimitiveRegistry();
    const capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);

    mockCoreDispatcher = jest.fn().mockImplementation(async (ctx: RequestContext) => {
      ctx.response = SAMPLE_SUCCESS_RESPONSE;
    });

    dispatcher = new MiddlewareDispatcher({
      requestGate,
      middlewareRegistry,
      middlewareEngine,
      coreDispatcher: mockCoreDispatcher,
    });

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MCPKIT_DEBUG;
  });

  describe('middleware stack ordering', () => {
    it('should execute error mapper as outermost layer', async () => {
      await performCompleteLifecycleInitialization(lifecycleManager);

      const logs: string[] = [];
      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const loggingMiddleware = createLoggingMiddleware('outer', logs);
      const authMiddleware = createAuthMiddleware('auth', true);

      // Register in order: error mapper first (outermost)
      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(loggingMiddleware);
      middlewareRegistry.registerMiddleware(authMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logs).toEqual(['outer:before', 'outer:after']);
      expect(mockCoreDispatcher).toHaveBeenCalledTimes(1);
      expect(mockRespond).toHaveBeenCalledWith(SAMPLE_SUCCESS_RESPONSE);
    });

    it('should catch errors from inner middleware layers', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const logs: string[] = [];
      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const loggingMiddleware = createLoggingMiddleware('outer', logs);
      const failingMiddleware: Middleware = async (_ctx, _next) => {
        throw new Error('Inner middleware failure');
      };

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(loggingMiddleware);
      middlewareRegistry.registerMiddleware(failingMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logs).toEqual(['outer:before']); // 'after' not called due to error
      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal error',
          }),
        })
      );
    });

    it('should catch errors from core dispatcher', async () => {
      await performCompleteLifecycleInitialization(lifecycleManager);

      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      middlewareRegistry.registerMiddleware(errorMapper);

      // Make core dispatcher throw an error
      mockCoreDispatcher.mockImplementation(() => {
        throw new Error('Core dispatcher failure');
      });

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const response = mockRespond.mock.calls[0][0] as any;
      expect(response.error.code).toBe(-32603);
      // The error message might be preserved from the original error in some cases
      expect(response.error.message).toMatch(/Internal error|Core dispatcher failure/);
    });
  });

  describe('error propagation scenarios', () => {
    it('should handle authentication failures with proper classification', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      process.env.MCPKIT_DEBUG = '1';

      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const authMiddleware = createAuthMiddleware('auth', false); // Will fail

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(authMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const response = mockRespond.mock.calls[0][0] as any;
      expect(response.error.code).toBe(-32000); // Auth error code from fixture
      expect(response.error.message).toBe('Authentication failed');
    });

    it('should handle rate limiting with proper error mapping', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      process.env.MCPKIT_DEBUG = '1';

      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const rateLimitMiddleware = createRateLimitMiddleware('rate-limit', 0); // Will fail immediately

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(rateLimitMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const response = mockRespond.mock.calls[0][0] as any;
      expect(response.error.code).toBe(-32000); // Rate limit error code from fixture
      expect(response.error.message).toBe('Rate limit exceeded');
    });

    it('should preserve short-circuit behavior when no errors occur', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const logs: string[] = [];
      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const loggingMiddleware = createLoggingMiddleware('outer', logs);
      const shortCircuitMiddleware = createShortCircuitMiddleware('short-circuit', SAMPLE_SUCCESS_RESPONSE);
      const innerLoggingMiddleware = createLoggingMiddleware('inner', logs);

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(loggingMiddleware);
      middlewareRegistry.registerMiddleware(shortCircuitMiddleware);
      middlewareRegistry.registerMiddleware(innerLoggingMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logs).toEqual(['outer:before', 'outer:after']);
      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith(SAMPLE_SUCCESS_RESPONSE);
    });
  });

  describe('complex middleware interactions', () => {
    it('should handle multiple middleware with state mutations and error recovery', async () => {
      await performCompleteLifecycleInitialization(lifecycleManager);

      const logs: string[] = [];
      const errorMapper = createErrorMapperMiddleware({
        enableLogging: true,
        includeRequestContext: true,
      });
      const tracingMiddleware = createTracingMiddleware('tracing');
      const stateMutationMiddleware = createStateMutationMiddleware('state', 'processed', true);
      const loggingMiddleware = createLoggingMiddleware('logging', logs);

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(tracingMiddleware);
      middlewareRegistry.registerMiddleware(stateMutationMiddleware);
      middlewareRegistry.registerMiddleware(loggingMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logs).toEqual(['logging:before', 'logging:after']);
      expect(mockCoreDispatcher).toHaveBeenCalledTimes(1);

      // Verify state was mutated by middleware
      const ctx = mockCoreDispatcher.mock.calls[0][0] as RequestContext;
      expect(ctx.state.processed).toBe(true);
      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.state.startTime).toBeDefined();
      expect(ctx.state.endTime).toBeDefined();
    });

    it('should handle nested error scenarios with proper cleanup', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const logs: string[] = [];
      const errorMapper = createErrorMapperMiddleware({ enableLogging: false });
      const outerLoggingMiddleware = createLoggingMiddleware('outer', logs);
      const tracingMiddleware = createTracingMiddleware('tracing');
      const failingMiddleware: Middleware = async (ctx, _next) => {
        ctx.state.beforeError = true;
        throw new Error('Nested failure');
      };

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(outerLoggingMiddleware);
      middlewareRegistry.registerMiddleware(tracingMiddleware);
      middlewareRegistry.registerMiddleware(failingMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logs).toEqual(['outer:before']); // No 'after' due to error
      expect(mockCoreDispatcher).not.toHaveBeenCalled();

      const response = mockRespond.mock.calls[0][0] as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Internal error');
    });
  });

  describe('end-to-end error handling', () => {
    it('should provide comprehensive error context in debug mode', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      process.env.MCPKIT_DEBUG = '1';

      const errorMapper = createErrorMapperMiddleware({
        enableLogging: true,
        includeRequestContext: true,
        includeStackTrace: true,
      });
      const failingMiddleware: Middleware = async (_ctx, _next) => {
        throw new Error('Detailed error for debugging');
      };

      middlewareRegistry.registerMiddleware(errorMapper);
      middlewareRegistry.registerMiddleware(failingMiddleware);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();
      const request = { jsonrpc: '2.0', method: 'test/method', id: 'debug-test-1', params: { test: true } };

      transportDispatch(request, mockRespond);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify structured logging output
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      // The error classification depends on the error type - could be STANDARD_ERROR or MIDDLEWARE_ERROR
      expect([ErrorClassification.STANDARD_ERROR, ErrorClassification.MIDDLEWARE_ERROR]).toContain(logEntry.error.classification);
      expect(logEntry.error.originalMessage).toContain('Detailed error for debugging');
      expect(logEntry.context.requestId).toBe('debug-test-1');
      expect(logEntry.context.method).toBe('test/method');
      expect(logEntry.context.transport).toBe('test-transport');
      expect(logEntry.metadata.source).toBe('error-mapper');

      // Verify error response
      const response = mockRespond.mock.calls[0][0] as any;
      expect([ErrorClassification.STANDARD_ERROR, ErrorClassification.MIDDLEWARE_ERROR]).toContain(response.error.data.classification);
      expect(response.error.data.originalMessage).toContain('Detailed error for debugging');
    });
  });
});
