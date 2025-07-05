import {
  LifecycleState,
  McpCapabilityRegistry,
  McpLifecycleManager,
  McpRequestGate,
  MockPrimitiveRegistry,
  RequestCategory,
} from '../../src/lifecycle/index';

import { ALWAYS_ALLOWED_REQUESTS, OPERATIONAL_REQUESTS, VALID_INITIALIZE_REQUEST } from '../fixtures/handshake-fixtures';

describe('McpRequestGate', () => {
  let requestGate: McpRequestGate;
  let lifecycleManager: McpLifecycleManager;
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;

  beforeEach(() => {
    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
  });

  describe('request categorization', () => {
    it('should categorize initialization requests correctly', () => {
      expect(requestGate.getRequestCategory('initialize')).toBe(RequestCategory.INITIALIZATION);
      expect(requestGate.getRequestCategory('notifications/initialized')).toBe(RequestCategory.INITIALIZATION);
    });

    it('should categorize always allowed requests correctly', () => {
      expect(requestGate.getRequestCategory('ping')).toBe(RequestCategory.ALWAYS_ALLOWED);
      expect(requestGate.getRequestCategory('notifications/cancelled')).toBe(RequestCategory.ALWAYS_ALLOWED);
      expect(requestGate.getRequestCategory('notifications/progress')).toBe(RequestCategory.ALWAYS_ALLOWED);
    });

    it('should categorize operational requests correctly', () => {
      expect(requestGate.getRequestCategory('prompts/list')).toBe(RequestCategory.OPERATIONAL);
      expect(requestGate.getRequestCategory('tools/call')).toBe(RequestCategory.OPERATIONAL);
      expect(requestGate.getRequestCategory('resources/read')).toBe(RequestCategory.OPERATIONAL);
    });

    it('should treat unknown requests as operational', () => {
      expect(requestGate.getRequestCategory('unknown/method')).toBe(RequestCategory.OPERATIONAL);
    });

    it('should allow adding custom request categories', () => {
      requestGate.addRequestCategory('custom/method', RequestCategory.ALWAYS_ALLOWED);
      expect(requestGate.getRequestCategory('custom/method')).toBe(RequestCategory.ALWAYS_ALLOWED);
    });
  });

  describe('request validation in IDLE state', () => {
    it('should allow always allowed requests', () => {
      for (const request of ALWAYS_ALLOWED_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(true);
        expect(() => requestGate.validateRequest(request.method)).not.toThrow();
      }
    });

    it('should allow initialize request', () => {
      expect(requestGate.canProcessRequest('initialize')).toBe(true);
      expect(() => requestGate.validateRequest('initialize')).not.toThrow();
    });

    it('should reject operational requests', () => {
      for (const request of OPERATIONAL_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(false);
        expect(() => requestGate.validateRequest(request.method)).toThrow();
      }
    });

    it('should reject initialized notification', () => {
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(false);
      expect(() => requestGate.validateRequest('notifications/initialized')).toThrow();
    });
  });

  describe('request validation in INITIALIZING state', () => {
    beforeEach(() => {
      // Manually set the state to INITIALIZING for testing
      (lifecycleManager as any)._currentState = 'initializing';
    });

    it('should allow always allowed requests', () => {
      for (const request of ALWAYS_ALLOWED_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(true);
      }
    });

    it('should reject initialize request (already initializing)', () => {
      expect(requestGate.canProcessRequest('initialize')).toBe(false);
    });

    it('should reject operational requests', () => {
      for (const request of OPERATIONAL_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(false);
      }
    });

    it('should reject initialized notification (not ready yet)', () => {
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(false);
    });

    it('should provide specific error messages for INITIALIZING state violations', () => {
      // Test initialize request during initialization
      const initError = requestGate.getValidationError('initialize');
      expect(initError).toMatchObject({
        code: -32600,
        message: 'Server already initialized. Cannot initialize again.',
      });

      // Test operational request during initialization
      const operationalError = requestGate.getValidationError('tools/list');
      expect(operationalError).toMatchObject({
        code: -32000,
        message: expect.stringContaining("Operational request 'tools/list' requires server to be in ready state"),
        data: {
          currentState: LifecycleState.INITIALIZING,
          operation: 'tools/list',
        },
      });

      // Test initialized notification during initialization
      const notificationError = requestGate.getValidationError('notifications/initialized');
      expect(notificationError).toMatchObject({
        code: -32000,
        message: expect.stringContaining('Initialized notification can only be sent when server is ready'),
        data: {
          currentState: LifecycleState.INITIALIZING,
          operation: 'notifications/initialized',
        },
      });
    });

    it('should handle rapid request validation during INITIALIZING state', () => {
      // Simulate rapid requests during initialization
      const methods = ['tools/list', 'prompts/list', 'resources/list', 'ping', 'initialize'];

      for (let i = 0; i < 100; i++) {
        for (const method of methods) {
          const canProcess = requestGate.canProcessRequest(method);
          const error = requestGate.getValidationError(method);

          if (method === 'ping') {
            expect(canProcess).toBe(true);
            expect(error).toBeNull();
          } else if (method === 'initialize') {
            expect(canProcess).toBe(false);
            expect(error).not.toBeNull();
          } else {
            expect(canProcess).toBe(false);
            expect(error).not.toBeNull();
          }
        }
      }
    });

    it('should provide validation summary for INITIALIZING state', () => {
      const summary = requestGate.getValidationSummary();

      expect(summary).toMatchObject({
        currentState: LifecycleState.INITIALIZING,
        isInitialized: true, // INITIALIZING state means initialized=true
        isReady: false,
        allowedCategories: [RequestCategory.ALWAYS_ALLOWED],
      });
    });
  });

  describe('request validation in READY state', () => {
    beforeEach(async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
    });

    it('should allow always allowed requests', () => {
      for (const request of ALWAYS_ALLOWED_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(true);
      }
    });

    it('should allow operational requests', () => {
      for (const request of OPERATIONAL_REQUESTS) {
        expect(requestGate.canProcessRequest(request.method)).toBe(true);
        expect(() => requestGate.validateRequest(request.method)).not.toThrow();
      }
    });

    it('should allow initialized notification', () => {
      expect(requestGate.canProcessRequest('notifications/initialized')).toBe(true);
      expect(() => requestGate.validateRequest('notifications/initialized')).not.toThrow();
    });

    it('should reject duplicate initialize request', () => {
      expect(requestGate.canProcessRequest('initialize')).toBe(false);
      expect(() => requestGate.validateRequest('initialize')).toThrow();
    });
  });

  describe('error handling', () => {
    it('should provide validation errors for not initialized requests', () => {
      const error = requestGate.getValidationError('prompts/list');

      expect(error).toMatchObject({
        code: -32002,
        message: "Server not initialized. Cannot process 'prompts/list' request before initialization.",
      });
    });

    it('should provide validation errors for already initialized requests', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      const error = requestGate.getValidationError('initialize');

      expect(error).toMatchObject({
        code: -32600,
        message: 'Server already initialized. Cannot initialize again.',
      });
    });

    it('should return null for valid requests', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      const error = requestGate.getValidationError('prompts/list');
      expect(error).toBeNull();
    });

    it('should handle lifecycle violation errors', () => {
      // Manually set the state to INITIALIZING for testing
      (lifecycleManager as any)._currentState = 'initializing';

      const error = requestGate.getValidationError('prompts/list');

      expect(error).toMatchObject({
        code: -32000,
        message: expect.stringContaining("Operational request 'prompts/list' requires server to be in ready state"),
        data: {
          currentState: LifecycleState.INITIALIZING,
          operation: 'prompts/list',
        },
      });
    });

    it('should provide validation errors for post-shutdown requests', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      await lifecycleManager.shutdown('Test shutdown');

      const error = requestGate.getValidationError('prompts/list');

      expect(error).toMatchObject({
        code: -32003,
        message: "Server has been shut down. Cannot process 'prompts/list' request after shutdown.",
      });
    });
  });

  describe('validation summary', () => {
    it('should provide validation summary for IDLE state', () => {
      const summary = requestGate.getValidationSummary();

      expect(summary).toMatchObject({
        currentState: LifecycleState.IDLE,
        isInitialized: false,
        isReady: false,
        allowedCategories: [RequestCategory.ALWAYS_ALLOWED, RequestCategory.INITIALIZATION],
      });
    });

    it('should provide validation summary for READY state', async () => {
      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);

      const summary = requestGate.getValidationSummary();

      expect(summary).toMatchObject({
        currentState: LifecycleState.READY,
        isInitialized: true,
        isReady: true,
        allowedCategories: [RequestCategory.ALWAYS_ALLOWED, RequestCategory.OPERATIONAL],
      });
    });
  });

  describe('state queries', () => {
    it('should report current state correctly', async () => {
      expect(requestGate.getCurrentState()).toBe(LifecycleState.IDLE);

      await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST);
      expect(requestGate.getCurrentState()).toBe(LifecycleState.READY);
    });
  });
});
