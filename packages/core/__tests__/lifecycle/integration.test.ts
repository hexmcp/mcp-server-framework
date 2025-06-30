import {
  LifecycleEvent,
  LifecycleState,
  McpCapabilityRegistry,
  McpHandshakeHandlers,
  McpLifecycleManager,
  McpRequestGate,
  MockPrimitiveRegistry,
} from '../../dist/lifecycle/index.js';

import { OPERATIONAL_REQUESTS, VALID_INITIALIZE_REQUEST_WITH_ID, VALID_INITIALIZED_NOTIFICATION } from '../fixtures/handshake-fixtures.ts';

describe('MCP Lifecycle Integration', () => {
  let lifecycleManager: McpLifecycleManager;
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;
  let handshakeHandlers: McpHandshakeHandlers;
  let requestGate: McpRequestGate;

  beforeEach(() => {
    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    handshakeHandlers = new McpHandshakeHandlers(lifecycleManager);
    requestGate = new McpRequestGate(lifecycleManager);
  });

  describe('complete handshake flow', () => {
    it('should complete full MCP handshake sequence', async () => {
      const events: any[] = [];

      // Listen to all lifecycle events
      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        events.push({ type: 'state-changed', event });
      });
      lifecycleManager.on(LifecycleEvent.INITIALIZATION_STARTED, (event) => {
        events.push({ type: 'init-started', event });
      });
      lifecycleManager.on(LifecycleEvent.INITIALIZATION_COMPLETED, (event) => {
        events.push({ type: 'init-completed', event });
      });

      // Step 1: Client sends initialize request
      expect(requestGate.canProcessRequest('initialize')).toBe(true);

      const initResponse = await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      expect(initResponse).toMatchObject({
        jsonrpc: '2.0',
        id: VALID_INITIALIZE_REQUEST_WITH_ID.id,
        result: expect.any(Object),
      });

      // Step 2: Server is now ready
      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
      expect(handshakeHandlers.isReady()).toBe(true);

      // Step 3: Client sends initialized notification
      await expect(handshakeHandlers.handleInitialized(VALID_INITIALIZED_NOTIFICATION)).resolves.toBeUndefined();

      // Step 4: Operational requests are now allowed
      for (const request of OPERATIONAL_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(true);
      }

      // Verify events were emitted correctly
      expect(events).toHaveLength(4); // 2 state changes + 2 init events
      expect(events.map((e) => e.type)).toEqual([
        'state-changed', // idle -> initializing
        'init-started',
        'state-changed', // initializing -> ready
        'init-completed',
      ]);
    });

    it('should handle handshake with dynamic capabilities', async () => {
      // Register some primitives
      primitiveRegistry.setPromptCount(2);
      primitiveRegistry.setToolCount(3);
      primitiveRegistry.setResourceCount(1);

      const initResponse = await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      const result = (initResponse as any).result;
      expect(result.capabilities).toMatchObject({
        experimental: {},
        logging: {},
        prompts: {},
        tools: {},
        resources: {
          subscribe: false,
          listChanged: false,
        },
      });
    });

    it('should reject operational requests before initialization', () => {
      for (const request of OPERATIONAL_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(false);

        const error = requestGate.getValidationError(request.method);
        expect(error).toMatchObject({
          code: -32600,
          message: expect.stringContaining('Server not initialized'),
        });
      }
    });

    it('should handle initialization failure gracefully', async () => {
      const invalidRequest = {
        ...VALID_INITIALIZE_REQUEST_WITH_ID,
        params: {
          ...VALID_INITIALIZE_REQUEST_WITH_ID.params,
          protocolVersion: 'invalid-version',
        },
      };

      const response = await handshakeHandlers.handleInitialize(invalidRequest as any);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: invalidRequest.id,
        error: {
          code: -32603,
          message: expect.stringContaining('Unsupported protocol version'),
        },
      });

      // Server should remain in IDLE state
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(handshakeHandlers.isInitialized()).toBe(false);

      // Operational requests should still be rejected
      expect(requestGate.canProcessRequest('prompts/list')).toBe(false);
    });
  });

  describe('shutdown flow', () => {
    it('should handle complete shutdown sequence', async () => {
      // Initialize first
      await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);

      const shutdownEvents: any[] = [];
      lifecycleManager.on(LifecycleEvent.SHUTDOWN_STARTED, (event) => {
        shutdownEvents.push({ type: 'shutdown-started', event });
      });
      lifecycleManager.on(LifecycleEvent.SHUTDOWN_COMPLETED, (event) => {
        shutdownEvents.push({ type: 'shutdown-completed', event });
      });

      // Shutdown
      const shutdownResponse = await handshakeHandlers.handleShutdown({
        id: 'test-shutdown',
        params: { reason: 'Integration test shutdown' },
      });

      expect(shutdownResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-shutdown',
        result: null,
      });

      // Server should be back to IDLE
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(handshakeHandlers.isInitialized()).toBe(false);

      // Operational requests should be rejected again
      expect(requestGate.canProcessRequest('prompts/list')).toBe(false);

      // Shutdown events should be emitted
      expect(shutdownEvents).toHaveLength(2);
      expect(shutdownEvents[0].type).toBe('shutdown-started');
      expect(shutdownEvents[1].type).toBe('shutdown-completed');
    });
  });

  describe('error scenarios', () => {
    it('should handle duplicate initialization attempts', async () => {
      // First initialization
      const response1 = await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      expect((response1 as any).result).toBeDefined();

      // Second initialization attempt
      const response2 = await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      expect(response2).toMatchObject({
        jsonrpc: '2.0',
        id: VALID_INITIALIZE_REQUEST_WITH_ID.id,
        error: {
          code: -32600,
          message: 'Server already initialized. Cannot initialize again.',
        },
      });
    });

    it('should handle initialized notification before ready state', async () => {
      await expect(handshakeHandlers.handleInitialized(VALID_INITIALIZED_NOTIFICATION)).rejects.toThrow(
        'Received initialized notification but server is not in ready state'
      );
    });

    it('should maintain consistency between components', async () => {
      // All components should report the same state
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(handshakeHandlers.getCurrentState()).toBe(LifecycleState.IDLE);
      expect(requestGate.getCurrentState()).toBe(LifecycleState.IDLE);

      await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);

      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
      expect(handshakeHandlers.getCurrentState()).toBe(LifecycleState.READY);
      expect(requestGate.getCurrentState()).toBe(LifecycleState.READY);

      expect(lifecycleManager.isReady).toBe(true);
      expect(handshakeHandlers.isReady()).toBe(true);
    });
  });

  describe('capability integration', () => {
    it('should reflect capability changes in handshake response', async () => {
      // Enable static capabilities
      capabilityRegistry.enableCompletion();
      capabilityRegistry.enableResources({ subscribe: true, listChanged: true });

      // Add dynamic capabilities
      primitiveRegistry.setPromptCount(1);

      const response = await handshakeHandlers.handleInitialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      const result = (response as any).result;

      expect(result.capabilities).toMatchObject({
        experimental: {},
        logging: {},
        completion: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
        prompts: {},
      });
    });
  });
});
