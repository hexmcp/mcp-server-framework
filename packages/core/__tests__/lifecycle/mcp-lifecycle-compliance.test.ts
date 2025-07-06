import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  AlreadyInitializedError,
  LifecycleEvent,
  LifecycleState,
  LifecycleViolationError,
  McpCapabilityRegistry,
  McpLifecycleManager,
  NotInitializedError,
  PostShutdownError,
} from '../../src/lifecycle';

describe('MCP Lifecycle Compliance', () => {
  let lifecycleManager: McpLifecycleManager;
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
  });

  describe('Lifecycle State Transitions', () => {
    it('should start in IDLE state', () => {
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.isReady).toBe(false);
      expect(lifecycleManager.hasBeenInitialized).toBe(false);
    });

    it('should transition from IDLE to INITIALIZING on initialize', async () => {
      const stateChanges: LifecycleState[] = [];
      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event.currentState);
      });

      await lifecycleManager.initialize(validInitializeRequest);

      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
      expect(lifecycleManager.isInitialized).toBe(true);
      expect(lifecycleManager.isReady).toBe(false);
      expect(lifecycleManager.hasBeenInitialized).toBe(true);
      expect(stateChanges).toContain(LifecycleState.INITIALIZING);
    });

    it('should transition from INITIALIZING to READY on initialized notification', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      const stateChanges: LifecycleState[] = [];
      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event.currentState);
      });

      await lifecycleManager.initialized();

      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
      expect(lifecycleManager.isReady).toBe(true);
      expect(stateChanges).toContain(LifecycleState.READY);
    });

    it('should emit READY event when transitioning to ready state', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      const readyEvents: any[] = [];
      lifecycleManager.on(LifecycleEvent.READY, (event) => {
        readyEvents.push(event);
      });

      await lifecycleManager.initialized();

      expect(readyEvents).toHaveLength(1);
      expect(readyEvents[0].state).toBe(LifecycleState.READY);
      expect(readyEvents[0].timestamp).toBeInstanceOf(Date);
    });

    it('should complete full lifecycle sequence correctly', async () => {
      const events: string[] = [];

      lifecycleManager.on(LifecycleEvent.INITIALIZATION_STARTED, () => events.push('init-started'));
      lifecycleManager.on(LifecycleEvent.INITIALIZATION_COMPLETED, () => events.push('init-completed'));
      lifecycleManager.on(LifecycleEvent.READY, () => events.push('ready'));

      // Initialize
      await lifecycleManager.initialize(validInitializeRequest);
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);

      // Send initialized notification
      await lifecycleManager.initialized();
      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);

      expect(events).toEqual(['init-started', 'init-completed', 'ready']);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should throw AlreadyInitializedError on duplicate initialization', async () => {
      await lifecycleManager.initialize(validInitializeRequest);

      await expect(lifecycleManager.initialize(validInitializeRequest)).rejects.toThrow(AlreadyInitializedError);
    });

    it('should throw LifecycleViolationError on initialized notification in wrong state', async () => {
      // Try to send initialized notification without initializing first
      await expect(lifecycleManager.initialized()).rejects.toThrow(LifecycleViolationError);

      // Initialize and transition to ready
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();

      // Try to send initialized notification again
      await expect(lifecycleManager.initialized()).rejects.toThrow(LifecycleViolationError);
    });

    it('should validate operations against current state', () => {
      // Before initialization
      expect(() => lifecycleManager.validateOperation('tools/list')).toThrow(NotInitializedError);

      // Operations that are always allowed
      expect(() => lifecycleManager.validateOperation('initialize')).not.toThrow();
      expect(() => lifecycleManager.validateOperation('ping')).not.toThrow();
    });

    it('should handle initialization failure correctly', async () => {
      const invalidRequest = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          protocolVersion: 'invalid-version',
        },
      };

      const failedEvents: any[] = [];
      lifecycleManager.on(LifecycleEvent.INITIALIZATION_FAILED, (event) => {
        failedEvents.push(event);
      });

      await expect(lifecycleManager.initialize(invalidRequest)).rejects.toThrow('Unsupported protocol version');

      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].error).toBeInstanceOf(Error);
    });
  });

  describe('Protocol Version Support', () => {
    it('should support MCP protocol version 2025-06-18', async () => {
      const request = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          protocolVersion: '2025-06-18',
        },
      };

      const result = await lifecycleManager.initialize(request);
      expect(result.protocolVersion).toBe('2025-06-18');
    });

    it('should support MCP protocol version 2025-03-26', async () => {
      const request = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          protocolVersion: '2025-03-26',
        },
      };

      const result = await lifecycleManager.initialize(request);
      expect(result.protocolVersion).toBe('2025-03-26');
    });

    it('should support MCP protocol version 2024-11-05', async () => {
      const request = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          protocolVersion: '2024-11-05',
        },
      };

      const result = await lifecycleManager.initialize(request);
      expect(result.protocolVersion).toBe('2024-11-05');
    });

    it('should reject unsupported protocol versions', async () => {
      const request = {
        ...validInitializeRequest,
        params: {
          ...validInitializeRequest.params,
          protocolVersion: '1.0.0',
        },
      };

      await expect(lifecycleManager.initialize(request)).rejects.toThrow('Unsupported protocol version: 1.0.0');
    });
  });

  describe('Shutdown Handling', () => {
    it('should transition to shutting-down state on shutdown', async () => {
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();

      const stateChanges: LifecycleState[] = [];
      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event.currentState);
      });

      await lifecycleManager.shutdown('Test shutdown');

      expect(stateChanges).toContain(LifecycleState.SHUTTING_DOWN);
      expect(stateChanges).toContain(LifecycleState.IDLE);
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
    });

    it('should track hasBeenInitialized after shutdown', async () => {
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();
      await lifecycleManager.shutdown();

      expect(lifecycleManager.hasBeenInitialized).toBe(true);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.isReady).toBe(false);
    });

    it('should validate post-shutdown operations correctly', async () => {
      await lifecycleManager.initialize(validInitializeRequest);
      await lifecycleManager.initialized();
      await lifecycleManager.shutdown();

      // After shutdown, operational requests should throw PostShutdownError
      expect(() => lifecycleManager.validateOperation('tools/list')).toThrow(PostShutdownError);
    });
  });
});
