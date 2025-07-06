import {
  AlreadyInitializedError,
  InvalidStateTransitionError,
  LifecycleEvent,
  LifecycleState,
  LifecycleViolationError,
  McpCapabilityRegistry,
  McpLifecycleManager,
  MockPrimitiveRegistry,
  NotInitializedError,
} from '../../src/lifecycle/index';

import { INVALID_PROTOCOL_VERSION_REQUEST, VALID_INITIALIZE_REQUEST } from '../fixtures/handshake-fixtures';

describe('McpLifecycleManager', () => {
  let lifecycleManager: McpLifecycleManager;
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;

  beforeEach(() => {
    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
  });

  describe('initial state', () => {
    it('should start in IDLE state', () => {
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
    });

    it('should not be initialized initially', () => {
      expect(lifecycleManager.isInitialized).toBe(false);
    });

    it('should not be ready initially', () => {
      expect(lifecycleManager.isReady).toBe(false);
    });

    it('should have null initialize request and result initially', () => {
      expect(lifecycleManager.initializeRequest).toBeNull();
      expect(lifecycleManager.initializeResult).toBeNull();
    });

    it('should not have been initialized initially', () => {
      expect(lifecycleManager.hasBeenInitialized).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should successfully initialize from IDLE state', async () => {
      const stateChanges: any[] = [];
      const initEvents: any[] = [];

      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event);
      });

      lifecycleManager.on(LifecycleEvent.INITIALIZATION_STARTED, (event) => {
        initEvents.push({ type: 'started', event });
      });

      lifecycleManager.on(LifecycleEvent.INITIALIZATION_COMPLETED, (event) => {
        initEvents.push({ type: 'completed', event });
      });

      const result = await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      expect(result).toMatchObject({
        protocolVersion: VALID_INITIALIZE_REQUEST.params.protocolVersion,
        capabilities: expect.any(Object),
        serverInfo: expect.any(Object),
      });

      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
      expect(lifecycleManager.isInitialized).toBe(true);
      expect(lifecycleManager.isReady).toBe(false);
      expect(lifecycleManager.initializeRequest).toBe(VALID_INITIALIZE_REQUEST);
      expect(lifecycleManager.initializeResult).toBe(result);

      // Check state transitions - initialize() only goes to INITIALIZING
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toMatchObject({
        previousState: LifecycleState.IDLE,
        currentState: LifecycleState.INITIALIZING,
      });

      // Check initialization events
      expect(initEvents).toHaveLength(2);
      expect(initEvents[0].type).toBe('started');
      expect(initEvents[1].type).toBe('completed');
    });

    it('should reject initialization when already initialized', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      await expect(lifecycleManager.initialize(VALID_INITIALIZE_REQUEST)).rejects.toThrow(AlreadyInitializedError);
    });

    it('should handle initialization failure and reset to IDLE', async () => {
      const failureEvents: any[] = [];

      lifecycleManager.on(LifecycleEvent.INITIALIZATION_FAILED, (event) => {
        failureEvents.push(event);
      });

      await expect(lifecycleManager.initialize(INVALID_PROTOCOL_VERSION_REQUEST)).rejects.toThrow('Unsupported protocol version');

      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.initializeRequest).toBeNull();
      expect(failureEvents).toHaveLength(1);
    });

    it('should support legacy protocol versions', async () => {
      const legacyRequest = {
        ...VALID_INITIALIZE_REQUEST,
        params: {
          ...VALID_INITIALIZE_REQUEST.params,
          protocolVersion: '2024-11-05',
        },
      };

      const result = await lifecycleManager.initialize(legacyRequest);
      expect(result.protocolVersion).toBe('2024-11-05');
    });
  });

  describe('shutdown', () => {
    it('should successfully shutdown from READY state', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      const shutdownEvents: any[] = [];
      lifecycleManager.on(LifecycleEvent.SHUTDOWN_STARTED, (event) => {
        shutdownEvents.push({ type: 'started', event });
      });
      lifecycleManager.on(LifecycleEvent.SHUTDOWN_COMPLETED, (event) => {
        shutdownEvents.push({ type: 'completed', event });
      });

      await lifecycleManager.shutdown('Test shutdown');

      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.initializeRequest).toBeNull();
      expect(lifecycleManager.initializeResult).toBeNull();

      expect(shutdownEvents).toHaveLength(2);
      expect(shutdownEvents[0].type).toBe('started');
      expect(shutdownEvents[1].type).toBe('completed');
      expect(shutdownEvents[0].event.reason).toBe('Test shutdown');
    });

    it('should be idempotent when already in IDLE state', async () => {
      await lifecycleManager.shutdown();
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
    });

    it('should be idempotent when already shutting down', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      // Start shutdown but don't await
      const shutdownPromise1 = lifecycleManager.shutdown();
      const shutdownPromise2 = lifecycleManager.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
    });

    it('should maintain hasBeenInitialized flag after shutdown', async () => {
      expect(lifecycleManager.hasBeenInitialized).toBe(false);

      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      expect(lifecycleManager.hasBeenInitialized).toBe(true);

      await lifecycleManager.shutdown('Test shutdown');
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.hasBeenInitialized).toBe(true); // Should remain true
    });
  });

  describe('state transitions', () => {
    it('should validate valid transitions', () => {
      expect(lifecycleManager.canTransitionTo(LifecycleState.INITIALIZING)).toBe(true);
      expect(lifecycleManager.canTransitionTo(LifecycleState.READY)).toBe(false);
      expect(lifecycleManager.canTransitionTo(LifecycleState.SHUTTING_DOWN)).toBe(false);
    });

    it('should reject invalid transitions', () => {
      expect(() => {
        // Access private method for testing
        (lifecycleManager as any)._transitionTo(LifecycleState.READY);
      }).toThrow(InvalidStateTransitionError);
    });
  });

  describe('operation validation', () => {
    it('should allow initialize operation in IDLE state', () => {
      expect(() => {
        lifecycleManager.validateOperation('initialize');
      }).not.toThrow();
    });

    it('should allow ping operation in any state', () => {
      expect(() => {
        lifecycleManager.validateOperation('ping');
      }).not.toThrow();
    });

    it('should reject operational requests in IDLE state', () => {
      expect(() => {
        lifecycleManager.validateOperation('prompts/list');
      }).toThrow(NotInitializedError);
    });

    it('should reject operational requests in INITIALIZING state', async () => {
      const initPromise = lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      expect(() => {
        lifecycleManager.validateOperation('prompts/list');
      }).toThrow(LifecycleViolationError);

      await initPromise;
    });

    it('should allow operational requests in READY state', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      await lifecycleManager.initialized();

      expect(() => {
        lifecycleManager.validateOperation('prompts/list');
      }).not.toThrow();
    });
  });

  describe('INITIALIZING state edge cases', () => {
    it('should handle concurrent initialization attempts', async () => {
      const initPromise1 = lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      // Second initialization should be rejected immediately
      await expect(lifecycleManager.initialize(VALID_INITIALIZE_REQUEST)).rejects.toThrow(AlreadyInitializedError);

      // First initialization should still complete successfully
      const result = await initPromise1;
      expect(result).toBeDefined();
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
    });

    it('should maintain INITIALIZING state during async initialization', async () => {
      const statesDuringInit: LifecycleState[] = [];

      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        statesDuringInit.push(event.currentState);
      });

      const initPromise = lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      // Check state immediately after starting initialization
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
      expect(lifecycleManager.isInitialized).toBe(true); // INITIALIZING state means initialized=true
      expect(lifecycleManager.isReady).toBe(false);

      await initPromise;

      // Verify state progression - initialize should only go to INITIALIZING
      expect(statesDuringInit).toEqual([LifecycleState.INITIALIZING]);
    });

    it('should require initialized() call to reach READY state', async () => {
      const stateChanges: LifecycleState[] = [];

      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event.currentState);
      });

      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
      expect(lifecycleManager.isReady).toBe(false);

      await lifecycleManager.initialized();

      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
      expect(lifecycleManager.isReady).toBe(true);

      expect(stateChanges).toEqual([LifecycleState.INITIALIZING, LifecycleState.READY]);
    });

    it('should emit READY event when initialized() is called', async () => {
      const readyEvents: any[] = [];

      lifecycleManager.on(LifecycleEvent.READY, (event) => {
        readyEvents.push(event);
      });

      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      await lifecycleManager.initialized();

      expect(readyEvents).toHaveLength(1);
      expect(readyEvents[0]).toMatchObject({
        state: LifecycleState.READY,
        timestamp: expect.any(Date),
      });
    });

    it('should throw error if initialized() called in wrong state', async () => {
      await expect(lifecycleManager.initialized()).rejects.toThrow(
        'Initialized notification can only be sent when server is in initializing state'
      );

      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      await lifecycleManager.initialized();

      await expect(lifecycleManager.initialized()).rejects.toThrow(
        'Initialized notification can only be sent when server is in initializing state'
      );
    });

    it('should reject all operational requests during INITIALIZING state', async () => {
      const initPromise = lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      // Test multiple operational requests during initialization
      const operationalMethods = ['tools/list', 'prompts/list', 'resources/list', 'completion/complete'];

      for (const method of operationalMethods) {
        expect(() => {
          lifecycleManager.validateOperation(method);
        }).toThrow(LifecycleViolationError);
      }

      await initPromise;
    });

    it('should handle rapid state queries during initialization', async () => {
      const initPromise = lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      // Rapid state queries should be consistent
      for (let i = 0; i < 10; i++) {
        expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
        expect(lifecycleManager.isInitialized).toBe(true); // INITIALIZING state means initialized=true
        expect(lifecycleManager.isReady).toBe(false);
      }

      await initPromise;

      // After initialization, state should be INITIALIZING (not READY yet)
      for (let i = 0; i < 10; i++) {
        expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);
        expect(lifecycleManager.isInitialized).toBe(true);
        expect(lifecycleManager.isReady).toBe(false);
      }

      // Call initialized() to transition to READY
      await lifecycleManager.initialized();

      // Now state should be READY
      for (let i = 0; i < 10; i++) {
        expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
        expect(lifecycleManager.isInitialized).toBe(true);
        expect(lifecycleManager.isReady).toBe(true);
      }
    });

    it('should handle initialization failure and proper state reset', async () => {
      const stateChanges: any[] = [];
      const failureEvents: any[] = [];

      lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
        stateChanges.push(event);
      });

      lifecycleManager.on(LifecycleEvent.INITIALIZATION_FAILED, (event) => {
        failureEvents.push(event);
      });

      // Attempt initialization with invalid request
      await expect(lifecycleManager.initialize(INVALID_PROTOCOL_VERSION_REQUEST)).rejects.toThrow();

      // Should be back to IDLE state
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);
      expect(lifecycleManager.isInitialized).toBe(false);
      expect(lifecycleManager.isReady).toBe(false);
      expect(lifecycleManager.hasBeenInitialized).toBe(false);

      // Should have proper state transitions
      expect(stateChanges).toHaveLength(2);
      expect(stateChanges[0].currentState).toBe(LifecycleState.INITIALIZING);
      expect(stateChanges[1].currentState).toBe(LifecycleState.IDLE);

      // Should have failure event
      expect(failureEvents).toHaveLength(1);
    });
  });
});
