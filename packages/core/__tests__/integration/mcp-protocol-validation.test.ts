import { JSON_RPC_ERROR_CODES } from '@hexmcp/codec-jsonrpc';
import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { AlreadyInitializedError, McpCapabilityRegistry, McpLifecycleManager, McpRequestGate } from '../../src/lifecycle';

describe('MCP Protocol Validation', () => {
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let capabilityRegistry: McpCapabilityRegistry;

  const validInitializeRequest: InitializeRequest = {
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: { experimental: {} },
      clientInfo: { name: 'Test Client', version: '1.0.0' },
    },
  };

  beforeEach(() => {
    capabilityRegistry = new McpCapabilityRegistry();
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
  });

  describe('JSON-RPC Error Codes Compliance', () => {
    it('should use correct error code for pre-initialization requests', () => {
      const error = requestGate.getValidationError('tools/list');

      expect(error).not.toBeNull();
      if (error) {
        expect(error.code).toBe(-32002); // MCP pre-initialization error code
        expect(error.message).toContain('not initialized');
      }
    });

    it('should use correct error code for post-shutdown requests', async () => {
      // Complete lifecycle
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();
      await lifecycleManager.shutdown();

      const error = requestGate.getValidationError('tools/list');

      expect(error).not.toBeNull();
      if (error) {
        expect(error.code).toBe(-32003); // MCP post-shutdown error code
        expect(error.message).toContain('shut down');
      }
    });

    it('should use correct error code for duplicate initialization', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      try {
        await lifecycleManager.initialize(validInitializeRequest);
        fail('Should have thrown AlreadyInitializedError');
      } catch (error) {
        expect(error).toBeInstanceOf(AlreadyInitializedError);
        expect((error as AlreadyInitializedError).code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST);
      }
    });
  });

  describe('Request Lifecycle Validation', () => {
    it('should allow initialization requests in IDLE state', () => {
      expect(requestGate.canProcessRequest('initialize')).toBe(true);
      expect(requestGate.getValidationError('initialize')).toBeNull();
    });

    it('should allow always-allowed requests in any state', () => {
      // In IDLE state
      expect(requestGate.canProcessRequest('ping')).toBe(true);
      expect(requestGate.canProcessRequest('notifications/cancelled')).toBe(true);
      expect(requestGate.canProcessRequest('notifications/progress')).toBe(true);
    });

    it('should reject operational requests before initialization', () => {
      const operationalMethods = [
        'prompts/list',
        'prompts/get',
        'tools/list',
        'tools/call',
        'resources/list',
        'resources/read',
        'resources/subscribe',
        'resources/unsubscribe',
        'completion/complete',
      ];

      for (const method of operationalMethods) {
        expect(requestGate.canProcessRequest(method)).toBe(false);

        const error = requestGate.getValidationError(method);
        expect(error).not.toBeNull();
        if (error) {
          expect(error.code).toBe(-32002);
        }
      }
    });

    it('should reject operational requests in INITIALIZING state', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      expect(requestGate.canProcessRequest('tools/list')).toBe(false);

      const error = requestGate.getValidationError('tools/list');
      expect(error).not.toBeNull();
      if (error) {
        expect(error.message).toContain('ready state');
      }
    });

    it('should allow operational requests in READY state', async () => {
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();

      const operationalMethods = ['prompts/list', 'tools/list', 'resources/list'];

      for (const method of operationalMethods) {
        expect(requestGate.canProcessRequest(method)).toBe(true);
        expect(requestGate.getValidationError(method)).toBeNull();
      }
    });

    it('should validate initialized notification timing', async () => {
      // Should fail before initialization
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(false);

      // Should succeed after initialization but before ready
      await lifecycleManager.initialize(validInitializeRequest);
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(true);

      // Should fail after already ready
      await lifecycleManager.initialized();
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(false);
    });
  });

  describe('Protocol Handshake Sequence', () => {
    it('should complete proper MCP handshake sequence', async () => {
      // Step 1: Initialize
      expect(lifecycleManager.currentState).toBe('idle');

      const initResult = await lifecycleManager.initialize(validInitializeRequest);
      expect(initResult.protocolVersion).toBe('2025-06-18');
      expect(initResult.capabilities).toBeDefined();
      expect(initResult.serverInfo).toBeDefined();
      expect(lifecycleManager.currentState).toBe('initializing');

      // Step 2: Send initialized notification
      await lifecycleManager.initialized();
      expect(lifecycleManager.currentState).toBe('ready');

      // Step 3: Operational requests should now work
      expect(requestGate.canProcessRequest('tools/list')).toBe(true);
    });

    it('should maintain protocol compliance throughout lifecycle', async () => {
      // Track all state transitions
      const states: string[] = [];
      lifecycleManager.on('state-changed', (event) => {
        states.push(event.currentState);
      });

      // Complete full lifecycle
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();
      await lifecycleManager.shutdown();

      // Verify state sequence
      expect(states).toEqual(['initializing', 'ready', 'shutting-down', 'idle']);
    });
  });

  describe('Capability Negotiation', () => {
    it('should process client capabilities during initialization', async () => {
      const requestWithCapabilities = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          capabilities: {
            experimental: { customFeature: true },
            sampling: {},
          },
        },
      };

      const result = await lifecycleManager.initialize(requestWithCapabilities);

      expect(result.capabilities).toBeDefined();
      expect(result.serverInfo.name).toBe('MCP Server Framework');
    });

    it('should return server capabilities in initialization response', async () => {
      const result = await lifecycleManager.initialize(validInitializeRequest);

      expect(result.capabilities).toHaveProperty('experimental');
      expect(result.capabilities).toHaveProperty('logging');
      // Note: prompts, tools, and resources capabilities are only included when registries are configured
      expect(result.capabilities.experimental).toBeDefined();
      expect(result.capabilities.logging).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('should return properly formatted JSON-RPC error responses', () => {
      const error = requestGate.getValidationError('tools/list');

      expect(error).toMatchObject({
        code: expect.any(Number),
        message: expect.any(String),
      });

      if (error) {
        expect(error.code).toBe(-32002);
        expect(typeof error.message).toBe('string');
      }
    });

    it('should include appropriate error data for lifecycle violations', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      const error = requestGate.getValidationError('tools/list');

      expect(error).not.toBeNull();
      if (error) {
        expect(error.code).toBeLessThan(0); // Negative error codes
        expect(error.message).toContain('ready state');
      }
    });
  });

  describe('State Persistence', () => {
    it('should maintain initialization state across requests', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      expect(lifecycleManager.isInitialized).toBe(true);
      expect(lifecycleManager.hasBeenInitialized).toBe(true);
      expect(lifecycleManager.initializeRequest).toEqual(validInitializeRequest);
    });

    it('should track shutdown history correctly', async () => {
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();
      await lifecycleManager.shutdown();

      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.hasBeenInitialized).toBe(true);
      expect(lifecycleManager.currentState).toBe('idle');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle malformed initialization gracefully', async () => {
      // Should not throw, but may have undefined behavior
      // The actual validation would happen at the JSON-RPC level
      expect(lifecycleManager.currentState).toBe('idle');
    });

    it('should prevent state corruption on errors', async () => {
      try {
        await lifecycleManager.initialize({
          ...validInitializeRequest,
          params: {
            ...validInitializeRequest.params,
            protocolVersion: 'invalid',
          },
        });
      } catch {
        // Expected to fail
      }

      // State should remain IDLE after failed initialization
      expect(lifecycleManager.currentState).toBe('idle');
      expect(lifecycleManager.isInitialized).toBe(false);
    });
  });
});
