import { encodeJsonRpcSuccess } from '@hexmcp/codec-jsonrpc';

import { McpCapabilityRegistry, McpLifecycleManager, McpRequestGate, MockPrimitiveRegistry } from '../../src/lifecycle/index';
import { McpMiddlewareEngine, McpMiddlewareRegistry, MiddlewareDispatcher } from '../../src/middleware/index';
import { OPERATIONAL_REQUESTS, VALID_INITIALIZE_REQUEST_WITH_ID } from '../fixtures/handshake-fixtures';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createShortCircuitMiddleware,
  createStateMutationMiddleware,
  SAMPLE_SUCCESS_RESPONSE,
} from '../fixtures/middleware-fixtures';

describe('MiddlewareDispatcher', () => {
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let middlewareRegistry: McpMiddlewareRegistry;
  let middlewareEngine: McpMiddlewareEngine;
  let dispatcher: MiddlewareDispatcher;
  let mockCoreDispatcher: jest.Mock;

  beforeEach(() => {
    const primitiveRegistry = new MockPrimitiveRegistry();
    const capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
    middlewareRegistry = new McpMiddlewareRegistry();
    middlewareEngine = new McpMiddlewareEngine();

    mockCoreDispatcher = jest.fn().mockImplementation((ctx) => {
      ctx.response = SAMPLE_SUCCESS_RESPONSE;
    });

    dispatcher = new MiddlewareDispatcher({
      requestGate,
      middlewareRegistry,
      middlewareEngine,
      coreDispatcher: mockCoreDispatcher,
    });
  });

  describe('createTransportDispatch', () => {
    it('should create a transport dispatch function', () => {
      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      expect(typeof transportDispatch).toBe('function');
    });

    it('should handle valid JSON-RPC request without middleware', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(mockCoreDispatcher).toHaveBeenCalledTimes(1);
      expect(mockRespond).toHaveBeenCalledWith(SAMPLE_SUCCESS_RESPONSE);
    });

    it('should execute middleware before core dispatcher', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const logs: string[] = [];
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('auth', logs));
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('state', 'processed', true));

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(logs).toEqual(['auth:before', 'auth:after']);
      expect(mockCoreDispatcher).toHaveBeenCalledTimes(1);

      const ctx = mockCoreDispatcher.mock.calls[0]?.[0];
      expect(ctx.state.processed).toBe(true);
      expect(ctx.transport.name).toBe('test-transport');
    });

    it('should handle middleware short-circuiting', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const customResponse = encodeJsonRpcSuccess('test-1', { custom: 'response' });
      middlewareRegistry.registerMiddleware(createShortCircuitMiddleware('short-circuit', customResponse));
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('after', 'processed', true));

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith(customResponse);
    });

    it('should handle request gate validation errors', async () => {
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('pre-validation', []));

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledTimes(1);

      const response = mockRespond.mock.calls[0]?.[0] as any;
      expect(response.error.code).toBe(-32002);
    });

    it('should handle authentication failure', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      middlewareRegistry.registerMiddleware(createAuthMiddleware('auth', false));

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledTimes(1);

      const response = mockRespond.mock.calls[0]?.[0] as any;
      expect(response.error.code).toBe(-32000);
      expect(response.error.message).toBe('Authentication failed');
    });

    it('should handle invalid JSON-RPC messages', async () => {
      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      await transportDispatch({ invalid: 'message' }, mockRespond);

      expect(mockCoreDispatcher).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledTimes(1);

      const response = mockRespond.mock.calls[0]?.[0] as any;
      expect(response.error.code).toBe(-32600);
    });

    it('should handle transport metadata', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const transportDispatch = dispatcher.createTransportDispatch('stdio');
      const mockRespond = jest.fn();

      const metadata = {
        peer: { ip: '127.0.0.1', userAgent: 'test-client' },
        custom: 'metadata',
      };

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond, metadata);

      expect(mockCoreDispatcher).toHaveBeenCalledTimes(1);

      const ctx = mockCoreDispatcher.mock.calls[0]?.[0];
      expect(ctx.transport.name).toBe('stdio');
      expect(ctx.transport.peer).toEqual(metadata.peer);
    });

    it('should handle core dispatcher errors', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      mockCoreDispatcher.mockImplementation(() => {
        throw new Error('Core dispatcher error');
      });

      const transportDispatch = dispatcher.createTransportDispatch('test-transport');
      const mockRespond = jest.fn();

      const request = OPERATIONAL_REQUESTS[0] ?? { jsonrpc: '2.0', method: 'prompts/list', id: 'test-1' };

      await transportDispatch(request, mockRespond);

      expect(mockRespond).toHaveBeenCalledTimes(1);

      const response = mockRespond.mock.calls[0]?.[0] as any;
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('Core dispatcher error');
    });
  });

  describe('accessor methods', () => {
    it('should provide access to components', () => {
      expect(dispatcher.getRequestGate()).toBe(requestGate);
      expect(dispatcher.getMiddlewareRegistry()).toBe(middlewareRegistry);
      expect(dispatcher.getMiddlewareEngine()).toBe(middlewareEngine);
    });
  });
});
