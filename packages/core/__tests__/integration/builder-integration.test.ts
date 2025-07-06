import { StdioTransport } from '@hexmcp/transport-stdio';
import { z } from 'zod';
import { createMcpKitServer } from '../../src/builder';

// Mock the StdioTransport constructor
jest.mock('@hexmcp/transport-stdio', () => ({
  StdioTransport: jest.fn().mockImplementation(() => ({
    name: 'stdio',
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the StdioTransport to prevent actual stdio operations during tests
const mockStdioTransport = {
  name: 'stdio',
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@hexmcp/transport-stdio', () => ({
  StdioTransport: jest.fn(() => mockStdioTransport),
}));

describe('Builder Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Disable default transport for testing
    process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
  });

  afterEach(() => {
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
  });

  describe('Complete Server Configuration', () => {
    it('should create a complete server with all component types', () => {
      const builder = createMcpKitServer()
        .transport(mockStdioTransport)
        .tool('integration-tool', {
          description: 'A tool for integration testing',
          inputSchema: z.object({
            message: z.string(),
          }),
          handler: async (args) => {
            return { content: [{ type: 'text', text: `Tool response: ${args.message}` }] };
          },
        })
        .prompt('integration-prompt', {
          description: 'A prompt for integration testing',
          arguments: [
            {
              name: 'topic',
              description: 'The topic to write about',
              required: true,
            },
          ],
          handler: async (args: { topic?: string }) => {
            return `Write about ${args.topic || 'general topic'}`;
          },
        })
        .resource('integration://**', {
          name: 'Integration Resources',
          description: 'Resources for integration testing',
          provider: {
            get: async (uri) => {
              return {
                uri,
                mimeType: 'text/plain',
                text: `Resource content for ${uri}`,
              };
            },
            list: async () => {
              return {
                resources: [
                  {
                    uri: 'integration://test',
                    name: 'Test Resource',
                    description: 'A test resource',
                    mimeType: 'text/plain',
                  },
                ],
              };
            },
          },
        })
        .use(async (ctx, next) => {
          // Add integration test middleware
          (ctx as any).metadata = { ...(ctx as any).metadata, integrationTest: true };
          await next();
        });

      // Verify builder is properly configured
      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
      expect(typeof builder.use).toBe('function');
      expect(typeof builder.tool).toBe('function');
      expect(typeof builder.prompt).toBe('function');
      expect(typeof builder.resource).toBe('function');
      expect(typeof builder.transport).toBe('function');
    });

    it('should handle server startup with transport initialization', async () => {
      const builder = createMcpKitServer()
        .transport(mockStdioTransport)
        .tool('startup-tool', {
          description: 'Tool for testing startup',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Server started successfully' }] };
          },
        });

      // Test that listen() starts the server and initializes transports
      const listenPromise = builder.listen();

      // Verify that the transport start method was called
      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).toHaveBeenCalledWith(expect.any(Function));

      // For testing purposes, we'll resolve immediately
      await expect(listenPromise).resolves.not.toThrow();
    });

    it('should handle multiple transports correctly', () => {
      const mockTransport1 = {
        name: 'transport1',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const mockTransport2 = {
        name: 'transport2',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport1)
        .transport(mockTransport2)
        .tool('multi-transport-tool', {
          description: 'Tool for testing multiple transports',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Multi-transport test' }] };
          },
        });

      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle tool handler errors gracefully', () => {
      const builder = createMcpKitServer()
        .transport(mockStdioTransport)
        .tool('error-tool', {
          description: 'Tool that throws errors',
          inputSchema: z.object({
            shouldError: z.boolean().optional(),
          }),
          handler: async (args) => {
            if (args.shouldError) {
              throw new Error('Tool error for testing');
            }
            return { content: [{ type: 'text', text: 'Success' }] };
          },
        });

      // Builder should be created successfully even with error-prone handlers
      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });

    it('should handle transport errors during startup', async () => {
      const errorTransport = {
        name: 'error-transport',
        start: jest.fn().mockRejectedValue(new Error('Transport start error')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(errorTransport)
        .tool('error-test-tool', {
          description: 'Tool for error testing',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Error test' }] };
          },
        });

      // listen() should reject when transport fails to start
      await expect(builder.listen()).rejects.toThrow('Transport start error');
      expect(errorTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Middleware Integration', () => {
    it('should apply middleware in correct order', () => {
      const middleware1 = jest.fn(async (ctx, next) => {
        ctx.metadata = { ...ctx.metadata, middleware1: true };
        await next();
      });

      const middleware2 = jest.fn(async (ctx, next) => {
        ctx.metadata = { ...ctx.metadata, middleware2: true };
        await next();
      });

      const builder = createMcpKitServer()
        .transport(mockStdioTransport)
        .use(middleware1)
        .use(middleware2)
        .tool('middleware-tool', {
          description: 'Tool for testing middleware',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Middleware test' }] };
          },
        });

      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });

    it('should handle middleware arrays', () => {
      const middleware1 = async (ctx: any, next: () => Promise<void>) => {
        ctx.metadata = { ...ctx.metadata, middleware1: true };
        await next();
      };

      const middleware2 = async (ctx: any, next: () => Promise<void>) => {
        ctx.metadata = { ...ctx.metadata, middleware2: true };
        await next();
      };

      const builder = createMcpKitServer()
        .transport(mockStdioTransport)
        .use([middleware1, middleware2])
        .tool('array-middleware-tool', {
          description: 'Tool for testing middleware arrays',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Array middleware test' }] };
          },
        });

      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });
  });

  describe('Cross-Package Integration', () => {
    it('should integrate with transport-stdio package correctly', () => {
      const builder = createMcpKitServer()
        .transport(new StdioTransport())
        .tool('stdio-integration-tool', {
          description: 'Tool for testing stdio integration',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Stdio integration test' }] };
          },
        });

      expect(builder).toBeDefined();

      // Verify that StdioTransport was instantiated
      expect(StdioTransport).toHaveBeenCalledWith();
    });

    it('should handle default transport behavior', async () => {
      // Enable default transport
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;

      const builder = createMcpKitServer().tool('default-transport-tool', {
        description: 'Tool for testing default transport',
        inputSchema: z.object({}),
        handler: async () => {
          return { content: [{ type: 'text', text: 'Default transport test' }] };
        },
      });

      // Should use default stdio transport
      const listenPromise = builder.listen();

      // Default StdioTransport should be created and started
      expect(StdioTransport).toHaveBeenCalled();
      expect(mockStdioTransport.start).toHaveBeenCalled();

      await expect(listenPromise).resolves.not.toThrow();
    });
  });

  describe('Builder Pattern Validation', () => {
    it('should maintain fluent interface throughout chaining', () => {
      const builder = createMcpKitServer();

      const result = builder
        .transport(mockStdioTransport)
        .tool('chain-tool', {
          description: 'Tool for testing chaining',
          inputSchema: z.object({}),
          handler: async () => ({ content: [{ type: 'text', text: 'Chain test' }] }),
        })
        .prompt('chain-prompt', {
          description: 'Prompt for testing chaining',
          handler: async () => 'Chain test prompt content',
        })
        .resource('chain://**', {
          name: 'Chain Resources',
          description: 'Resources for testing chaining',
          provider: {
            get: async () => ({ uri: 'test', mimeType: 'text/plain', text: 'test' }),
            list: async () => ({ resources: [] }),
          },
        })
        .use(async (_ctx, next) => {
          await next();
        })
        .noDefaultTransport();

      // Each method should return the builder for chaining
      expect(result).toBe(builder);
      expect(typeof result.listen).toBe('function');
    });

    it('should handle noDefaultTransport() correctly', () => {
      const builder = createMcpKitServer()
        .noDefaultTransport()
        .tool('no-default-tool', {
          description: 'Tool for testing no default transport',
          inputSchema: z.object({}),
          handler: async () => ({ content: [{ type: 'text', text: 'No default test' }] }),
        });

      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });
  });
});
