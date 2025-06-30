import { addMiddlewareSupport, createMiddlewareBuilder, McpMiddlewareBuilder } from '../../src/middleware/builder.js';
import { McpMiddlewareRegistry } from '../../src/middleware/registry.js';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createTracingMiddleware,
} from '../fixtures/middleware-fixtures.js';

describe('MiddlewareBuilder', () => {
  let registry: McpMiddlewareRegistry;
  let builder: McpMiddlewareBuilder;

  beforeEach(() => {
    registry = new McpMiddlewareRegistry();
    builder = new McpMiddlewareBuilder(registry);
  });

  describe('basic functionality', () => {
    it('should register single middleware', () => {
      const middleware = createLoggingMiddleware('test', []);

      builder.use(middleware);

      expect(registry.size()).toBe(1);
      expect(registry.hasMiddleware(middleware)).toBe(true);
    });

    it('should register multiple middleware with spread syntax', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      builder.use(middleware1, middleware2, middleware3);

      expect(registry.size()).toBe(3);
      expect(registry.hasMiddleware(middleware1)).toBe(true);
      expect(registry.hasMiddleware(middleware2)).toBe(true);
      expect(registry.hasMiddleware(middleware3)).toBe(true);
    });

    it('should register middleware array', () => {
      const middleware = [
        createLoggingMiddleware('first', []),
        createLoggingMiddleware('second', []),
        createLoggingMiddleware('third', []),
      ];

      builder.use(middleware);

      expect(registry.size()).toBe(3);
      for (const mw of middleware) {
        expect(registry.hasMiddleware(mw)).toBe(true);
      }
    });

    it('should support method chaining', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      const result = builder.use(middleware1).use(middleware2).use(middleware3);

      expect(result).toBe(builder);
      expect(registry.size()).toBe(3);
    });

    it('should preserve registration order', () => {
      const middleware1 = createLoggingMiddleware('first', []);
      const middleware2 = createLoggingMiddleware('second', []);
      const middleware3 = createLoggingMiddleware('third', []);

      builder.use(middleware1).use(middleware2).use(middleware3);

      const stack = registry.getMiddlewareStack();
      expect(stack[0]).toBe(middleware1);
      expect(stack[1]).toBe(middleware2);
      expect(stack[2]).toBe(middleware3);
    });
  });

  describe('utility methods', () => {
    it('should clear middleware', () => {
      builder.use(createLoggingMiddleware('first', [])).use(createLoggingMiddleware('second', []));

      expect(registry.size()).toBe(2);

      const result = builder.clear();

      expect(result).toBe(builder);
      expect(registry.size()).toBe(0);
      expect(builder.isEmpty()).toBe(true);
    });

    it('should report size and empty state', () => {
      expect(builder.size()).toBe(0);
      expect(builder.isEmpty()).toBe(true);

      builder.use(createLoggingMiddleware('test', []));

      expect(builder.size()).toBe(1);
      expect(builder.isEmpty()).toBe(false);
    });

    it('should provide access to underlying registry', () => {
      const retrievedRegistry = builder.getMiddlewareRegistry();
      expect(retrievedRegistry).toBe(registry);
    });
  });

  describe('complex middleware scenarios', () => {
    it('should handle mixed registration patterns', () => {
      const auth = createAuthMiddleware('auth', true);
      const tracing = createTracingMiddleware('tracing');
      const rateLimit = createRateLimitMiddleware('rate-limit', 10);
      const logging = [createLoggingMiddleware('request-log', []), createLoggingMiddleware('response-log', [])];

      builder.use(auth).use(logging).use(tracing, rateLimit);

      expect(registry.size()).toBe(5);

      const stack = registry.getMiddlewareStack();
      expect(stack[0]).toBe(auth);
      expect(stack[1]).toBe(logging[0]);
      expect(stack[2]).toBe(logging[1]);
      expect(stack[3]).toBe(tracing);
      expect(stack[4]).toBe(rateLimit);
    });
  });
});

describe('createMiddlewareBuilder', () => {
  it('should create a middleware builder instance', () => {
    const registry = new McpMiddlewareRegistry();
    const builder = createMiddlewareBuilder(registry);

    expect(builder).toBeInstanceOf(McpMiddlewareBuilder);
    expect(builder.getMiddlewareRegistry()).toBe(registry);
  });
});

describe('addMiddlewareSupport', () => {
  it('should add middleware support to existing builder', () => {
    const existingBuilder = {
      someMethod: () => 'test',
      anotherProperty: 42,
    };

    const registry = new McpMiddlewareRegistry();
    const enhancedBuilder = addMiddlewareSupport(existingBuilder, registry);

    expect(enhancedBuilder.someMethod()).toBe('test');
    expect(enhancedBuilder.anotherProperty).toBe(42);
    expect(typeof enhancedBuilder.use).toBe('function');

    const middleware = createLoggingMiddleware('test', []);
    enhancedBuilder.use(middleware);

    expect(registry.hasMiddleware(middleware)).toBe(true);
  });

  it('should support method chaining on enhanced builder', () => {
    const existingBuilder = {
      build: function () {
        return this;
      },
    };

    const registry = new McpMiddlewareRegistry();
    const enhancedBuilder = addMiddlewareSupport(existingBuilder, registry);

    const middleware1 = createLoggingMiddleware('first', []);
    const middleware2 = createLoggingMiddleware('second', []);

    enhancedBuilder.use(middleware1).use(middleware2);

    const result = enhancedBuilder.build();

    expect(result).toBe(enhancedBuilder);
    expect(registry.size()).toBe(2);
  });

  it('should preserve original builder type', () => {
    interface CustomBuilder {
      customMethod(): string;
      customProperty: number;
    }

    const customBuilder: CustomBuilder = {
      customMethod: () => 'custom',
      customProperty: 123,
    };

    const registry = new McpMiddlewareRegistry();
    const enhanced = addMiddlewareSupport(customBuilder, registry);

    expect(enhanced.customMethod()).toBe('custom');
    expect(enhanced.customProperty).toBe(123);
    expect(typeof enhanced.use).toBe('function');
  });
});
