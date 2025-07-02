import { encodeJsonRpcSuccess } from '@hexmcp/codec-jsonrpc';
import type { RequestContext } from '../../src/middleware/types';

describe('Builder Middleware Integration', () => {
  describe('onion-style execution pattern', () => {
    it('should execute middleware in onion pattern', async () => {
      const executionOrder: string[] = [];

      const middleware1 = async (ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware1-enter');
        ctx.state.middleware1 = true;
        await next();
        executionOrder.push('middleware1-exit');
      };

      const middleware2 = async (ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware2-enter');
        ctx.state.middleware2 = true;
        await next();
        executionOrder.push('middleware2-exit');
      };

      const middleware3 = async (ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware3-enter');
        ctx.state.middleware3 = true;
        await next();
        executionOrder.push('middleware3-exit');
      };

      const coreHandler = async (ctx: RequestContext) => {
        executionOrder.push('core-handler');
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, { result: 'success' });
      };

      const mockContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 1,
          method: 'test/method',
          params: {},
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await middleware1(mockContext, async () => {
        await middleware2(mockContext, async () => {
          await middleware3(mockContext, async () => {
            await coreHandler(mockContext);
          });
        });
      });

      expect(executionOrder).toEqual([
        'middleware1-enter',
        'middleware2-enter',
        'middleware3-enter',
        'core-handler',
        'middleware3-exit',
        'middleware2-exit',
        'middleware1-exit',
      ]);

      expect(mockContext.state).toEqual({
        middleware1: true,
        middleware2: true,
        middleware3: true,
      });

      expect(mockContext.response).toEqual(encodeJsonRpcSuccess(1, { result: 'success' }));
    });

    it('should maintain context state across middleware layers', async () => {
      const middleware1 = async (ctx: RequestContext, next: () => Promise<void>) => {
        ctx.state.layer1 = 'data1';
        await next();
        expect(ctx.state.layer2).toBe('data2');
        expect(ctx.state.layer3).toBe('data3');
      };

      const middleware2 = async (ctx: RequestContext, next: () => Promise<void>) => {
        expect(ctx.state.layer1).toBe('data1');
        ctx.state.layer2 = 'data2';
        await next();
        expect(ctx.state.layer3).toBe('data3');
      };

      const middleware3 = async (ctx: RequestContext, next: () => Promise<void>) => {
        expect(ctx.state.layer1).toBe('data1');
        expect(ctx.state.layer2).toBe('data2');
        ctx.state.layer3 = 'data3';
        await next();
      };

      const coreHandler = async (ctx: RequestContext) => {
        expect(ctx.state.layer1).toBe('data1');
        expect(ctx.state.layer2).toBe('data2');
        expect(ctx.state.layer3).toBe('data3');
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, { result: 'success' });
      };

      const mockContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 2,
          method: 'test/method',
          params: {},
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await middleware1(mockContext, async () => {
        await middleware2(mockContext, async () => {
          await middleware3(mockContext, async () => {
            await coreHandler(mockContext);
          });
        });
      });
    });
  });

  describe('short-circuiting behavior', () => {
    it('should short-circuit when middleware sets response early', async () => {
      const executionOrder: string[] = [];

      const middleware1 = async (_ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware1-enter');
        await next();
        executionOrder.push('middleware1-exit');
      };

      const middleware2 = async (ctx: RequestContext, _next: () => Promise<void>) => {
        executionOrder.push('middleware2-enter');
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, { shortCircuit: true });
        executionOrder.push('middleware2-exit');
      };

      const middleware3 = async (_ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware3-enter');
        await next();
        executionOrder.push('middleware3-exit');
      };

      const coreHandler = async (_ctx: RequestContext) => {
        executionOrder.push('core-handler');
      };

      const mockContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 3,
          method: 'test/method',
          params: {},
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await middleware1(mockContext, async () => {
        await middleware2(mockContext, async () => {
          await middleware3(mockContext, async () => {
            await coreHandler(mockContext);
          });
        });
      });

      expect(executionOrder).toEqual(['middleware1-enter', 'middleware2-enter', 'middleware2-exit', 'middleware1-exit']);

      expect(mockContext.response).toEqual(encodeJsonRpcSuccess(3, { shortCircuit: true }));
    });

    it('should handle authentication middleware short-circuit', async () => {
      const authMiddleware = async (ctx: RequestContext, next: () => Promise<void>) => {
        const authHeader = (ctx.request.params as any)?.authorization;
        if (!authHeader || authHeader !== 'valid-token') {
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            error: {
              code: -32001,
              message: 'Unauthorized',
            },
          };
          return;
        }
        await next();
      };

      const coreHandler = async (ctx: RequestContext) => {
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, { result: 'authorized' });
      };

      const unauthorizedContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 4,
          method: 'test/method',
          params: { authorization: 'invalid-token' },
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await authMiddleware(unauthorizedContext, async () => {
        await coreHandler(unauthorizedContext);
      });

      expect(unauthorizedContext.response).toEqual({
        jsonrpc: '2.0',
        id: 4,
        error: {
          code: -32001,
          message: 'Unauthorized',
        },
      });

      const authorizedContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 5,
          method: 'test/method',
          params: { authorization: 'valid-token' },
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await authMiddleware(authorizedContext, async () => {
        await coreHandler(authorizedContext);
      });

      expect(authorizedContext.response).toEqual(encodeJsonRpcSuccess(5, { result: 'authorized' }));
    });
  });

  describe('error propagation', () => {
    it('should propagate errors through middleware stack', async () => {
      const executionOrder: string[] = [];

      const middleware1 = async (_ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware1-enter');
        try {
          await next();
        } catch (error) {
          executionOrder.push('middleware1-catch');
          throw error;
        }
        executionOrder.push('middleware1-exit');
      };

      const middleware2 = async (_ctx: RequestContext, next: () => Promise<void>) => {
        executionOrder.push('middleware2-enter');
        await next();
        executionOrder.push('middleware2-exit');
      };

      const failingHandler = async (_ctx: RequestContext) => {
        executionOrder.push('failing-handler');
        throw new Error('Handler error');
      };

      const mockContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 6,
          method: 'test/method',
          params: {},
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await expect(
        middleware1(mockContext, async () => {
          await middleware2(mockContext, async () => {
            await failingHandler(mockContext);
          });
        })
      ).rejects.toThrow('Handler error');

      expect(executionOrder).toEqual(['middleware1-enter', 'middleware2-enter', 'failing-handler', 'middleware1-catch']);
    });

    it('should handle middleware errors with error mapping', async () => {
      const errorMapperMiddleware = async (ctx: RequestContext, next: () => Promise<void>) => {
        try {
          await next();
        } catch (error) {
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
            },
          };
        }
      };

      const failingMiddleware = async (_ctx: RequestContext, _next: () => Promise<void>) => {
        throw new Error('Middleware failure');
      };

      const coreHandler = async (_ctx: RequestContext) => {
        // Should not be called
      };

      const mockContext: RequestContext = {
        request: {
          jsonrpc: '2.0',
          id: 7,
          method: 'test/method',
          params: {},
        },
        send: jest.fn(),
        transport: { name: 'test' },
        state: {},
      };

      await errorMapperMiddleware(mockContext, async () => {
        await failingMiddleware(mockContext, async () => {
          await coreHandler(mockContext);
        });
      });

      expect(mockContext.response).toEqual({
        jsonrpc: '2.0',
        id: 7,
        error: {
          code: -32603,
          message: 'Middleware failure',
        },
      });
    });
  });
});
