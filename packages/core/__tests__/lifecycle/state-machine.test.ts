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

      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
      expect(lifecycleManager.isInitialized).toBe(true);
      expect(lifecycleManager.isReady).toBe(true);
      expect(lifecycleManager.initializeRequest).toBe(VALID_INITIALIZE_REQUEST);
      expect(lifecycleManager.initializeResult).toBe(result);

      // Check state transitions
      expect(stateChanges).toHaveLength(2);
      expect(stateChanges[0]).toMatchObject({
        previousState: LifecycleState.IDLE,
        currentState: LifecycleState.INITIALIZING,
      });
      expect(stateChanges[1]).toMatchObject({
        previousState: LifecycleState.INITIALIZING,
        currentState: LifecycleState.READY,
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

      expect(() => {
        lifecycleManager.validateOperation('prompts/list');
      }).not.toThrow();
    });
  });
});
