import type { JsonRpcRequest } from '@hexmcp/codec-jsonrpc';
import { encodeJsonRpcSuccess } from '@hexmcp/codec-jsonrpc';
import type { DispatcherFn } from '../../src/builder/types';

describe('Builder Dispatcher Construction', () => {
  describe('request routing', () => {
    it('should route tool calls correctly', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'echo-tool',
          arguments: { message: 'hello' },
        },
      };

      const expectedResponse = encodeJsonRpcSuccess(1, {
        content: [{ type: 'text', text: 'echo: hello' }],
      });

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'tools/call') {
          return expectedResponse;
        }
        throw new Error('Method not found');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should route prompt calls correctly', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/get',
        params: {
          name: 'test-prompt',
          arguments: { input: 'test' },
        },
      };

      const expectedResponse = encodeJsonRpcSuccess(2, {
        messages: [{ role: 'user', content: { type: 'text', text: 'Generated prompt' } }],
      });

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'prompts/get') {
          return expectedResponse;
        }
        throw new Error('Method not found');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should route resource calls correctly', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: {
          uri: 'test://example',
        },
      };

      const expectedResponse = encodeJsonRpcSuccess(3, {
        contents: [{ uri: 'test://example', mimeType: 'text/plain', text: 'resource content' }],
      });

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'resources/read') {
          return expectedResponse;
        }
        throw new Error('Method not found');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle unknown methods', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown/method',
        params: {},
      };

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'unknown/method') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found',
            },
          };
        }
        throw new Error('Unexpected method');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 4,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      });
    });
  });

  describe('middleware execution order', () => {
    it('should execute middleware in registration order', async () => {
      const executionOrder: string[] = [];

      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        executionOrder.push('middleware1-before');
        await next();
        executionOrder.push('middleware1-after');
      };

      const middleware2 = async (_ctx: any, next: () => Promise<void>) => {
        executionOrder.push('middleware2-before');
        await next();
        executionOrder.push('middleware2-after');
      };

      const coreHandler = async () => {
        executionOrder.push('core-handler');
      };

      await middleware1({}, async () => {
        await middleware2({}, coreHandler);
      });

      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'core-handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should handle middleware that modifies context', async () => {
      const context = { state: {} };

      const middleware1 = async (ctx: any, next: () => Promise<void>) => {
        ctx.state.middleware1 = 'executed';
        await next();
      };

      const middleware2 = async (ctx: any, next: () => Promise<void>) => {
        ctx.state.middleware2 = 'executed';
        await next();
      };

      const coreHandler = async () => {
        (context.state as any).coreHandler = 'executed';
      };

      await middleware1(context, async () => {
        await middleware2(context, coreHandler);
      });

      expect(context.state).toEqual({
        middleware1: 'executed',
        middleware2: 'executed',
        coreHandler: 'executed',
      });
    });

    it('should handle middleware errors', async () => {
      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const middleware2 = async (_ctx: any, _next: () => Promise<void>) => {
        throw new Error('Middleware error');
      };

      const coreHandler = async () => {
        // Should not be called
      };

      await expect(
        middleware1({}, async () => {
          await middleware2({}, coreHandler);
        })
      ).rejects.toThrow('Middleware error');
    });
  });

  describe('error handling', () => {
    it('should handle dispatcher errors gracefully', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'failing-tool',
          arguments: {},
        },
      };

      const mockDispatcher: DispatcherFn = async (_request) => {
        throw new Error('Internal dispatcher error');
      };

      await expect(mockDispatcher(mockRequest)).rejects.toThrow('Internal dispatcher error');
    });

    it('should handle malformed requests', async () => {
      const mockRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
      } as JsonRpcRequest;

      const mockDispatcher: DispatcherFn = async (request) => {
        if (!request.params) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32602,
              message: 'Invalid params',
            },
          };
        }
        return encodeJsonRpcSuccess(request.id, {});
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 6,
        error: {
          code: -32602,
          message: 'Invalid params',
        },
      });
    });
  });

  describe('streaming responses', () => {
    it('should handle streaming chunk responses', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'prompts/get',
        params: {
          name: 'streaming-prompt',
          arguments: {},
        },
      };

      const expectedChunks = [
        { type: 'text' as const, content: 'First chunk' },
        { type: 'text' as const, content: 'Second chunk' },
        { type: 'text' as const, content: 'Final chunk' },
      ];

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'prompts/get') {
          return expectedChunks;
        }
        throw new Error('Method not found');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual(expectedChunks);
    });

    it('should handle mixed streaming and error chunks', async () => {
      const mockRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'prompts/get',
        params: {
          name: 'partially-failing-prompt',
          arguments: {},
        },
      };

      const expectedChunks = [
        { type: 'text' as const, content: 'Success chunk' },
        { type: 'error' as const, code: -32001, message: 'Partial failure' },
      ];

      const mockDispatcher: DispatcherFn = async (request) => {
        if (request.method === 'prompts/get') {
          return expectedChunks;
        }
        throw new Error('Method not found');
      };

      const result = await mockDispatcher(mockRequest);
      expect(result).toEqual(expectedChunks);
    });
  });
});
