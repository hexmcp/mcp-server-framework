import type { TransportDispatch } from '@hexmcp/transport';
import { createMcpKitServer } from '../../src/builder';

const mockStdioTransport = {
  name: 'stdio',
  start: jest.fn(async (dispatch: TransportDispatch) => {
    // Store the dispatch function for testing
    mockStdioTransport.dispatch = dispatch;
  }),
  stop: jest.fn(async () => {
    // Mock stop implementation
  }),
  dispatch: null as TransportDispatch | null,
};

jest.mock(
  '@hexmcp/transport-stdio',
  () => ({
    StdioTransport: jest.fn(() => mockStdioTransport),
  }),
  { virtual: true }
);

describe('Default Transport Integration Tests', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    jest.clearAllMocks();
    mockStdioTransport.dispatch = null;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = originalEnv;
    } else {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    }
  });

  describe('end-to-end MCP server with default transport', () => {
    it('should create a working MCP server with just tools and no explicit transport', async () => {
      const server = createMcpKitServer().tool('echo', {
        description: 'Echo back the input',
        parameters: [
          {
            name: 'message',
            type: 'string',
            description: 'The message to echo back',
            required: true,
          },
        ],
        handler: async ({ message }) => ({
          content: [{ type: 'text', text: `Echo: ${message}` }],
        }),
      });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).toHaveBeenCalledWith(expect.any(Function));
      expect(mockStdioTransport.dispatch).toBeDefined();
    });

    it('should create a working MCP server with tools, resources, and prompts', async () => {
      const server = createMcpKitServer()
        .tool('calculate', {
          description: 'Perform calculation',
          parameters: [
            {
              name: 'operation',
              type: 'string',
              description: 'The operation to perform',
              required: true,
            },
            {
              name: 'a',
              type: 'number',
              description: 'First number',
              required: true,
            },
            {
              name: 'b',
              type: 'number',
              description: 'Second number',
              required: true,
            },
          ],
          handler: async ({ operation, a, b }) => {
            const result = operation === 'add' ? (a as number) + (b as number) : (a as number) - (b as number);
            return { content: [{ type: 'text', text: `Result: ${result}` }] };
          },
        })
        .resource('data://**', {
          description: 'Data resource',
          provider: {
            get: async (uri: string) => `Data for ${uri}`,
            list: async () => ({ resources: [] }),
          },
        })
        .prompt('summarize', {
          description: 'Summarize content',
          handler: async ({ content }) => `Summary: ${content}`,
        });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.dispatch).toBeDefined();
    });

    it('should work with middleware and default transport', async () => {
      const middlewareCallOrder: string[] = [];

      const loggingMiddleware = async (_ctx: any, next: () => Promise<void>) => {
        middlewareCallOrder.push('logging-start');
        await next();
        middlewareCallOrder.push('logging-end');
      };

      const authMiddleware = async (_ctx: any, next: () => Promise<void>) => {
        middlewareCallOrder.push('auth-start');
        await next();
        middlewareCallOrder.push('auth-end');
      };

      const server = createMcpKitServer()
        .use(loggingMiddleware)
        .use(authMiddleware)
        .tool('test', {
          description: 'Test tool',
          handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.dispatch).toBeDefined();
    });
  });

  describe('dispatcher integration with default transport', () => {
    it('should provide a working dispatcher to the default transport', async () => {
      const server = createMcpKitServer().tool('ping', {
        description: 'Ping tool',
        handler: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
      });

      await server.listen();

      expect(mockStdioTransport.dispatch).toBeDefined();
      expect(typeof mockStdioTransport.dispatch).toBe('function');
    });

    it('should handle dispatcher calls correctly', async () => {
      const server = createMcpKitServer().tool('greet', {
        description: 'Greeting tool',
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Name to greet',
            required: true,
          },
        ],
        handler: async ({ name }) => ({
          content: [{ type: 'text', text: `Hello, ${name}!` }],
        }),
      });

      await server.listen();

      const dispatch = mockStdioTransport.dispatch;
      expect(dispatch).toBeDefined();

      // Test that the dispatcher can handle requests
      let _responseReceived: any = null;
      const mockRespond = jest.fn(async (response: any) => {
        _responseReceived = response;
      });

      const testRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      if (dispatch) {
        dispatch(testRequest, mockRespond);

        // Give some time for async processing
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockRespond).toHaveBeenCalled();
      }
    });
  });

  describe('error scenarios with default transport', () => {
    it('should handle transport start errors gracefully', async () => {
      // Mock transport start failure
      mockStdioTransport.start.mockRejectedValueOnce(new Error('Transport failed to start'));

      const server = createMcpKitServer().tool('test', {
        description: 'Test tool',
        handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
      });

      await expect(server.listen()).rejects.toThrow('Transport failed to start');
    });
  });

  describe('complex integration scenarios', () => {
    it('should work with streaming middleware and default transport', async () => {
      const streamingMiddleware = async (ctx: any, next: () => Promise<void>) => {
        // Mock streaming context
        ctx.streamInfo = (_message: string) => {
          // Mock streaming implementation
        };
        await next();
      };

      const server = createMcpKitServer()
        .use(streamingMiddleware)
        .tool('process', {
          description: 'Process data with streaming',
          parameters: [
            {
              name: 'data',
              type: 'string',
              description: 'Data to process',
              required: true,
            },
          ],
          handler: async ({ data }, ctx: any) => {
            // Use streaming if available
            if (ctx.streamInfo) {
              ctx.streamInfo('Processing started...');
              ctx.streamInfo('Processing completed');
            }
            return { content: [{ type: 'text', text: `Processed: ${data}` }] };
          },
        });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should work with error handling middleware and default transport', async () => {
      const errorHandlingMiddleware = async (ctx: any, next: () => Promise<void>) => {
        try {
          await next();
        } catch (_error) {
          // Mock error handling
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            error: { code: -32603, message: 'Internal error' },
          };
        }
      };

      const server = createMcpKitServer()
        .use(errorHandlingMiddleware)
        .tool('failing-tool', {
          description: 'Tool that fails',
          handler: async () => {
            throw new Error('Tool failed');
          },
        });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should work with multiple middleware layers and default transport', async () => {
      const middleware1 = async (ctx: any, next: () => Promise<void>) => {
        ctx.layer1 = true;
        await next();
      };

      const middleware2 = async (ctx: any, next: () => Promise<void>) => {
        ctx.layer2 = true;
        await next();
      };

      const middleware3 = async (ctx: any, next: () => Promise<void>) => {
        ctx.layer3 = true;
        await next();
      };

      const server = createMcpKitServer()
        .use(middleware1)
        .use(middleware2)
        .use(middleware3)
        .tool('layered', {
          description: 'Tool with layered middleware',
          handler: async (_args, ctx: any) => {
            return {
              content: [
                {
                  type: 'text',
                  text: `Layers: ${ctx.layer1}, ${ctx.layer2}, ${ctx.layer3}`,
                },
              ],
            };
          },
        });

      await server.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });
  });
});
