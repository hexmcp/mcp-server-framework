import {
  LifecycleState,
  McpCapabilityRegistry,
  McpHandshakeHandlers,
  McpLifecycleManager,
  MockPrimitiveRegistry,
} from '../../src/lifecycle/index';

import {
  INVALID_PROTOCOL_VERSION_REQUEST,
  MISSING_CAPABILITIES_REQUEST,
  MISSING_PARAMS_REQUEST,
  MISSING_PROTOCOL_VERSION_REQUEST,
  performCompleteInitialization,
  SHUTDOWN_REQUEST,
  SHUTDOWN_REQUEST_NO_REASON,
  VALID_INITIALIZE_REQUEST,
  VALID_INITIALIZE_REQUEST_WITH_ID,
  VALID_INITIALIZED_NOTIFICATION,
} from '../fixtures/handshake-fixtures';

describe('McpHandshakeHandlers', () => {
  let handlers: McpHandshakeHandlers;
  let lifecycleManager: McpLifecycleManager;
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;

  beforeEach(() => {
    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    handlers = new McpHandshakeHandlers(lifecycleManager);
  });

  describe('handleInitialize', () => {
    it('should successfully handle valid initialize request', async () => {
      const response = await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: VALID_INITIALIZE_REQUEST_WITH_ID.id,
        result: {
          protocolVersion: VALID_INITIALIZE_REQUEST_WITH_ID.params.protocolVersion,
          capabilities: expect.any(Object),
          serverInfo: {
            name: 'MCP Server Framework',
            version: '1.0.0',
          },
        },
      });

      expect(handlers.isInitialized()).toBe(true);
      expect(handlers.isReady()).toBe(false);
      expect(handlers.getCurrentState()).toBe(LifecycleState.INITIALIZING);
    });

    it('should reject initialize request with missing params', async () => {
      const response = await handlers.handleInitialize(MISSING_PARAMS_REQUEST as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: MISSING_PARAMS_REQUEST.id,
        error: {
          code: -32602,
          message: 'Missing required params in initialize request',
        },
      });
    });

    it('should reject initialize request with missing protocol version', async () => {
      const response = await handlers.handleInitialize(MISSING_PROTOCOL_VERSION_REQUEST as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: MISSING_PROTOCOL_VERSION_REQUEST.id,
        error: {
          code: -32602,
          message: 'Missing required protocolVersion in initialize request',
        },
      });
    });

    it('should reject initialize request with missing capabilities', async () => {
      const response = await handlers.handleInitialize(MISSING_CAPABILITIES_REQUEST as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: MISSING_CAPABILITIES_REQUEST.id,
        error: {
          code: -32602,
          message: 'Missing required capabilities in initialize request',
        },
      });
    });

    it('should reject initialize request with unsupported protocol version', async () => {
      const requestWithId = {
        ...INVALID_PROTOCOL_VERSION_REQUEST,
        id: 'test-invalid-version',
      };

      const response = await handlers.handleInitialize(requestWithId as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: requestWithId.id,
        error: {
          code: -32603,
          message: 'Unsupported protocol version: 2023-01-01',
        },
      });
    });

    it('should reject duplicate initialize requests', async () => {
      await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const response = await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: VALID_INITIALIZE_REQUEST_WITH_ID.id,
        error: {
          code: -32600,
          message: 'Server already initialized. Cannot initialize again.',
        },
      });
    });

    it('should handle initialize request without id field', async () => {
      const response = await handlers.handleInitialize(VALID_INITIALIZE_REQUEST as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        result: {
          protocolVersion: VALID_INITIALIZE_REQUEST.params.protocolVersion,
          capabilities: expect.any(Object),
          serverInfo: {
            name: 'MCP Server Framework',
            version: '1.0.0',
          },
        },
      });

      expect(handlers.isInitialized()).toBe(true);
      expect(handlers.isReady()).toBe(false);
      expect(handlers.getCurrentState()).toBe(LifecycleState.INITIALIZING);
    });

    it('should handle error response without id field', async () => {
      const requestWithoutId = {
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
        },
      };

      const response = await handlers.handleInitialize(requestWithoutId as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'Missing required capabilities in initialize request',
        },
      });
    });
  });

  describe('handleInitialized', () => {
    it('should successfully handle initialized notification when in initializing state', async () => {
      await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      await expect(handlers.handleInitialized(VALID_INITIALIZED_NOTIFICATION)).resolves.toBeUndefined();

      expect(handlers.isReady()).toBe(true);
      expect(handlers.getCurrentState()).toBe(LifecycleState.READY);
    });

    it('should reject initialized notification when not in initializing state', async () => {
      await expect(handlers.handleInitialized(VALID_INITIALIZED_NOTIFICATION)).rejects.toThrow(
        'Initialized notification can only be sent when server is in initializing state'
      );
    });
  });

  describe('handleShutdown', () => {
    it('should successfully handle shutdown request with reason', async () => {
      await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const response = await handlers.handleShutdown(SHUTDOWN_REQUEST);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: SHUTDOWN_REQUEST.id,
        result: null,
      });

      expect(handlers.isInitialized()).toBe(false);
      expect(handlers.getCurrentState()).toBe(LifecycleState.IDLE);
    });

    it('should successfully handle shutdown request without reason', async () => {
      await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const response = await handlers.handleShutdown(SHUTDOWN_REQUEST_NO_REASON);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: SHUTDOWN_REQUEST_NO_REASON.id,
        result: null,
      });
    });

    it('should handle shutdown from idle state', async () => {
      const response = await handlers.handleShutdown(SHUTDOWN_REQUEST);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: SHUTDOWN_REQUEST.id,
        result: null,
      });
    });

    it('should handle shutdown request without id field', async () => {
      await handlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const shutdownRequestWithoutId = {
        params: { reason: 'Test shutdown without ID' },
      };

      const response = await handlers.handleShutdown(shutdownRequestWithoutId as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        result: null,
      });
    });
  });

  describe('request validation', () => {
    it('should validate requests correctly', () => {
      expect(() => handlers.validateRequest('ping')).not.toThrow();
      expect(() => handlers.validateRequest('initialize')).not.toThrow();

      expect(() => handlers.validateRequest('prompts/list')).toThrow();
    });

    it('should allow operational requests after initialization', async () => {
      await performCompleteInitialization(handlers);

      expect(() => handlers.validateRequest('prompts/list')).not.toThrow();
      expect(() => handlers.validateRequest('tools/call')).not.toThrow();
      expect(() => handlers.validateRequest('resources/read')).not.toThrow();
    });
  });

  describe('error response helpers', () => {
    it('should create not initialized error', () => {
      const error = handlers.createNotInitializedError('test-id', 'prompts/list');

      expect(error).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-id',
        error: {
          code: -32600,
          message: "Server not initialized. Cannot process 'prompts/list' request before initialization.",
        },
      });
    });

    it('should create invalid state error', () => {
      const error = handlers.createInvalidStateError('test-id', 'prompts/list', 'initializing');

      expect(error).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-id',
        error: {
          code: -32600,
          message: "Operation 'prompts/list' not allowed in state 'initializing'",
        },
      });
    });
  });

  describe('state queries', () => {
    it('should report correct state information', async () => {
      expect(handlers.isInitialized()).toBe(false);
      expect(handlers.isReady()).toBe(false);
      expect(handlers.getCurrentState()).toBe(LifecycleState.IDLE);

      await performCompleteInitialization(handlers);

      expect(handlers.isInitialized()).toBe(true);
      expect(handlers.isReady()).toBe(true);
      expect(handlers.getCurrentState()).toBe(LifecycleState.READY);
    });
  });
});
