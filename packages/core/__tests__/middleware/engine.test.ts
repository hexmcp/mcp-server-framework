import { McpMiddlewareEngine, MiddlewareError, ReentrantCallError } from '../../src/middleware/engine.js';
import {
  createAuthMiddleware,
  createDelayMiddleware,
  createErrorMiddleware,
  createLoggingMiddleware,
  createMockRequestContext,
  createReentrantCallMiddleware,
  createShortCircuitMiddleware,
  createStateMutationMiddleware,
  createTracingMiddleware,
  SAMPLE_SUCCESS_RESPONSE,
} from '../fixtures/middleware-fixtures.js';

describe('McpMiddlewareEngine', () => {
  let engine: McpMiddlewareEngine;

  beforeEach(() => {
    engine = new McpMiddlewareEngine();
  });

  describe('applyMiddleware', () => {
    it('should handle empty middleware stack', async () => {
      const ctx = createMockRequestContext();
      const finalMiddleware = jest.fn().mockResolvedValue(undefined);

      const composedMiddleware = engine.applyMiddleware([]);
      await composedMiddleware(ctx, finalMiddleware);

      expect(finalMiddleware).toHaveBeenCalledTimes(1);
    });

    it('should execute middleware in correct order (onion pattern)', async () => {
      const logs: string[] = [];
      const middleware = [
        createLoggingMiddleware('first', logs),
        createLoggingMiddleware('second', logs),
        createLoggingMiddleware('third', logs),
      ];

      const ctx = createMockRequestContext();
      const finalMiddleware = jest.fn().mockImplementation(() => {
        logs.push('final');
      });

      const composedMiddleware = engine.applyMiddleware(middleware);
      await composedMiddleware(ctx, finalMiddleware);

      expect(logs).toEqual(['first:before', 'second:before', 'third:before', 'final', 'third:after', 'second:after', 'first:after']);
    });

    it('should propagate errors from middleware', async () => {
      const error = new Error('Test middleware error');
      const middleware = [
        createLoggingMiddleware('first', []),
        createErrorMiddleware('error', error),
        createLoggingMiddleware('third', []),
      ];

      const ctx = createMockRequestContext();
      const finalMiddleware = jest.fn();

      const composedMiddleware = engine.applyMiddleware(middleware);

      await expect(composedMiddleware(ctx, finalMiddleware)).rejects.toThrow(MiddlewareError);
      expect(finalMiddleware).not.toHaveBeenCalled();
    });

    it('should handle short-circuiting when response is set', async () => {
      const logs: string[] = [];
      const middleware = [
        createLoggingMiddleware('first', logs),
        createShortCircuitMiddleware('short-circuit', SAMPLE_SUCCESS_RESPONSE),
        createLoggingMiddleware('third', logs),
      ];

      const ctx = createMockRequestContext();
      const finalMiddleware = jest.fn();

      const composedMiddleware = engine.applyMiddleware(middleware);
      await composedMiddleware(ctx, finalMiddleware);

      expect(ctx.response).toEqual(SAMPLE_SUCCESS_RESPONSE);
      expect(logs).toEqual(['first:before', 'first:after']);
      expect(finalMiddleware).not.toHaveBeenCalled();
    });
  });

  describe('executeMiddleware', () => {
    it('should execute single middleware correctly', async () => {
      const logs: string[] = [];
      const middleware = [createLoggingMiddleware('test', logs)];
      const ctx = createMockRequestContext();

      await engine.executeMiddleware(ctx, middleware);

      expect(logs).toEqual(['test:before', 'test:after']);
    });

    it('should handle context state mutation', async () => {
      const middleware = [
        createStateMutationMiddleware('state1', 'key1', 'value1'),
        createStateMutationMiddleware('state2', 'key2', 'value2'),
        createTracingMiddleware('tracing'),
      ];

      const ctx = createMockRequestContext();
      await engine.executeMiddleware(ctx, middleware);

      expect(ctx.state.key1).toBe('value1');
      expect(ctx.state.key2).toBe('value2');
      expect(ctx.state.traceId).toBeDefined();
      expect(ctx.state.startTime).toBeDefined();
      expect(ctx.state.endTime).toBeDefined();
      expect(ctx.state.duration).toBeDefined();
    });

    it.skip('should detect re-entrant calls', async () => {
      const middleware = [createReentrantCallMiddleware('reentrant'), createLoggingMiddleware('second', [])];
      const ctx = createMockRequestContext();

      await expect(engine.executeMiddleware(ctx, middleware)).rejects.toThrow(ReentrantCallError);
    });

    it('should track active executions', async () => {
      const middleware = [createDelayMiddleware('delay', 50)];
      const ctx = createMockRequestContext();

      const executionPromise = engine.executeMiddleware(ctx, middleware);

      expect(engine.isExecuting()).toBe(true);
      expect(engine.getActiveExecutions().size).toBe(1);

      await executionPromise;

      expect(engine.isExecuting()).toBe(false);
      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('infinite loop prevention', () => {
    it('should prevent execution timeout', async () => {
      const slowMiddleware = async (_ctx: any, next: any) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await next();
      };

      const middleware = [slowMiddleware];
      const ctx = createMockRequestContext();

      await expect(engine.executeMiddleware(ctx, middleware, { timeout: 50 })).rejects.toThrow('timed out after 50ms');
    });

    it('should prevent excessive call depth', async () => {
      const deepMiddleware = async (_ctx: any, next: any) => {
        await next();
      };

      // Create a stack of 10 middleware (should exceed maxDepth of 5)
      const middleware = Array(10).fill(deepMiddleware);
      const ctx = createMockRequestContext();

      await expect(engine.executeMiddleware(ctx, middleware, { maxDepth: 5 })).rejects.toThrow('Maximum call depth exceeded (5)');
    });

    it('should use default timeout and depth limits', async () => {
      const normalMiddleware = createLoggingMiddleware('normal', []);
      const middleware = [normalMiddleware];
      const ctx = createMockRequestContext();

      // Should not throw with normal middleware
      await expect(engine.executeMiddleware(ctx, middleware)).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should wrap middleware errors with context', async () => {
      const originalError = new Error('Original error');
      const middleware = [createErrorMiddleware('error-middleware', originalError)];
      const ctx = createMockRequestContext();

      try {
        await engine.executeMiddleware(ctx, middleware);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareError);
        const middlewareError = error as MiddlewareError;
        expect(middlewareError.middlewareIndex).toBe(0);
        expect(middlewareError.cause).toBe(originalError);
        expect(middlewareError.message).toContain('Middleware at index 0 failed');
      }
    });

    it('should clean up active executions on error', async () => {
      const middleware = [createErrorMiddleware('error', new Error('Test error'))];
      const ctx = createMockRequestContext();

      try {
        await engine.executeMiddleware(ctx, middleware);
      } catch {
        // Expected error
      }

      expect(engine.isExecuting()).toBe(false);
      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('authentication middleware scenario', () => {
    it('should handle successful authentication flow', async () => {
      const middleware = [createAuthMiddleware('auth', true), createStateMutationMiddleware('business-logic', 'processed', true)];

      const ctx = createMockRequestContext();
      await engine.executeMiddleware(ctx, middleware);

      expect(ctx.state.authenticated).toBe(true);
      expect(ctx.state.user).toEqual({ id: 'test-user', name: 'Test User' });
      expect(ctx.state.processed).toBe(true);
      expect(ctx.response).toBeUndefined();
    });

    it('should handle failed authentication with early termination', async () => {
      const middleware = [createAuthMiddleware('auth', false), createStateMutationMiddleware('business-logic', 'processed', true)];

      const ctx = createMockRequestContext();
      await engine.executeMiddleware(ctx, middleware);

      expect(ctx.state.authenticated).toBeUndefined();
      expect(ctx.state.processed).toBeUndefined();
      expect(ctx.response).toBeDefined();
      expect((ctx.response as any).error.code).toBe(-32000);
      expect((ctx.response as any).error.message).toBe('Authentication failed');
    });
  });
});
