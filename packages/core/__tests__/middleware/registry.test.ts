import { McpMiddlewareRegistry } from '../../src/middleware/registry';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createStateMutationMiddleware,
  createTracingMiddleware,
} from '../fixtures/middleware-fixtures';

describe('McpMiddlewareRegistry', () => {
  let registry: McpMiddlewareRegistry;

  beforeEach(() => {
    registry = new McpMiddlewareRegistry();
  });

  describe('basic operations', () => {
    it('should start empty', () => {
      expect(registry.size()).toBe(0);
      expect(registry.isEmpty()).toBe(true);
      expect(registry.getMiddlewareStack()).toEqual([]);
    });

    it('should register middleware in order', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      expect(registry.size()).toBe(3);
      expect(registry.isEmpty()).toBe(false);

      const stack = registry.getMiddlewareStack();
      expect(stack).toHaveLength(3);
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(middleware2);
      expect(stack[2]).toBe(middleware3);
    });

    it('should throw error for non-function middleware', () => {
      expect(() => {
        registry.registerMiddleware('not a function' as any);
      }).toThrow(TypeError);

      expect(() => {
        registry.registerMiddleware(null as any);
      }).toThrow(TypeError);

      expect(() => {
        registry.registerMiddleware(undefined as any);
      }).toThrow(TypeError);
    });

    it('should clear all middleware', () => {
      registry.registerMiddleware(createLoggingMiddleware('test1', []));
      registry.registerMiddleware(createLoggingMiddleware('test2', []));

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.isEmpty()).toBe(true);
      expect(registry.getMiddlewareStack()).toEqual([]);
    });
  });

  describe('middleware access and manipulation', () => {
    it('should get middleware at specific index', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);

      expect(registry.getMiddlewareAt(0)).toBe(middleware1);
      expect(registry.getMiddlewareAt(1)).toBe(middleware2);
      expect(registry.getMiddlewareAt(2)).toBeUndefined();
      expect(registry.getMiddlewareAt(-1)).toBeUndefined();
    });

    it('should remove middleware by reference', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      expect(registry.removeMiddleware(middleware2)).toBe(true);
      expect(registry.size()).toBe(2);

      const stack = registry.getMiddlewareStack();
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(middleware3);

      expect(registry.removeMiddleware(middleware2)).toBe(false);
    });

    it('should remove middleware by index', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      const removed = registry.removeMiddlewareAt(1);
      expect(removed).toBe(middleware2);
      expect(registry.size()).toBe(2);

      const stack = registry.getMiddlewareStack();
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(middleware3);

      expect(registry.removeMiddlewareAt(10)).toBeUndefined();
      expect(registry.removeMiddlewareAt(-1)).toBeUndefined();
    });

    it('should insert middleware at specific index', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);
      const middlewareInsert = createLoggingMiddleware('inserted', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      registry.insertMiddleware(middlewareInsert, 1);

      const stack = registry.getMiddlewareStack();
      expect(stack).toHaveLength(4);
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(middlewareInsert);
      expect(stack[2]).toBe(middleware2);
      expect(stack[3]).toBe(middleware3);
    });

    it('should throw error for invalid insert index', () => {
      registry.registerMiddleware(createLoggingMiddleware('test', []));

      const middleware = createLoggingMiddleware('insert', []);

      expect(() => {
        registry.insertMiddleware(middleware, -1);
      }).toThrow(RangeError);

      expect(() => {
        registry.insertMiddleware(middleware, 10);
      }).toThrow(RangeError);
    });

    it('should replace middleware', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);
      const replacement = createAuthMiddleware('replacement', true);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      expect(registry.replaceMiddleware(middleware2, replacement)).toBe(true);

      const stack = registry.getMiddlewareStack();
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(replacement);
      expect(stack[2]).toBe(middleware3);

      expect(registry.replaceMiddleware(createLoggingMiddleware('nonexistent', []), replacement)).toBe(false);
    });

    it('should check if middleware exists', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);

      expect(registry.hasMiddleware(middleware1)).toBe(true);
      expect(registry.hasMiddleware(middleware2)).toBe(true);
      expect(registry.hasMiddleware(middleware3)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should get middleware names', () => {
      const middleware1 = createLoggingMiddleware('auth', []);
      const middleware2 = createTracingMiddleware('tracing');
      const middleware3 = createStateMutationMiddleware('state', 'key', 'value');

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      const names = registry.getMiddlewareNames();
      expect(names).toEqual(['auth', 'tracing', 'state']);
    });

    it('should handle unnamed middleware', () => {
      const unnamedMiddleware = async (_ctx: any, next: any) => {
        await next();
      };

      registry.registerMiddleware(unnamedMiddleware);

      const names = registry.getMiddlewareNames();
      expect(names[0]).toBe(unnamedMiddleware.name || 'middleware-0');
    });

    it('should clone registry', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);

      const cloned = registry.clone();

      expect(cloned.size()).toBe(2);
      expect(cloned.getMiddlewareStack()).toEqual(registry.getMiddlewareStack());

      cloned.registerMiddleware(createLoggingMiddleware('third', []));

      expect(cloned.size()).toBe(3);
      expect(registry.size()).toBe(2);
    });

    it('should convert to array', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);

      const array = registry.toArray();
      expect(array).toEqual([middleware1, middleware2]);
      expect(array).not.toBe(registry.getMiddlewareStack());
    });

    it('should be iterable', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      registry.registerMiddleware(middleware1);
      registry.registerMiddleware(middleware2);
      registry.registerMiddleware(middleware3);

      const collected = [];
      for (const middleware of registry) {
        collected.push(middleware);
      }

      expect(collected).toEqual([middleware1, middleware2, middleware3]);
    });
  });
});
