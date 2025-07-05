import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

const mockStdioTransport = {
  name: 'stdio',
  start: jest.fn(async () => {
    // Mock start implementation
  }),
  stop: jest.fn(async () => {
    // Mock stop implementation
  }),
};

jest.mock('@hexmcp/transport-stdio', () => ({
  StdioTransport: jest.fn(() => mockStdioTransport),
}));

describe('McpServerBuilder', () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = originalEnv;
    } else {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('factory function', () => {
    it('should create a builder instance', () => {
      const builder = createMcpKitServer();
      expect(builder).toBeDefined();
      expect(typeof builder.use).toBe('function');
      expect(typeof builder.prompt).toBe('function');
      expect(typeof builder.tool).toBe('function');
      expect(typeof builder.resource).toBe('function');
      expect(typeof builder.transport).toBe('function');
      expect(typeof builder.noDefaultTransport).toBe('function');
      expect(typeof builder.listen).toBe('function');
    });
  });

  describe('fluent chaining', () => {
    let builder: McpServerBuilder;

    beforeEach(() => {
      builder = createMcpKitServer();
    });

    it('should allow chaining .use() with single middleware', () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const result = builder.use(middleware);
      expect(result).toBe(builder);
    });

    it('should allow chaining .use() with middleware array', () => {
      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };
      const middleware2 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const result = builder.use([middleware1, middleware2]);
      expect(result).toBe(builder);
    });

    it('should allow chaining .use() with spread middleware', () => {
      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };
      const middleware2 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const result = builder.use(middleware1, middleware2);
      expect(result).toBe(builder);
    });

    it('should allow chaining .prompt()', () => {
      const promptDef = {
        description: 'Test prompt',
        handler: async () => 'test response',
      };

      const result = builder.prompt('test-prompt', promptDef);
      expect(result).toBe(builder);
    });

    it('should allow chaining .tool()', () => {
      const toolDef = {
        description: 'Test tool',
        handler: async () => ({ content: 'test result' }),
      };

      const result = builder.tool('test-tool', toolDef);
      expect(result).toBe(builder);
    });

    it('should allow chaining .resource()', () => {
      const resourceDef = {
        name: 'Test Resource',
        provider: {
          get: async () => ({ data: 'test' }),
          list: async () => ({ resources: [] }),
        },
      };

      const result = builder.resource('test://', resourceDef);
      expect(result).toBe(builder);
    });

    it('should allow chaining .transport()', () => {
      const transport = {
        name: 'test-transport',
        start: async () => {
          // Mock start implementation
        },
        stop: async () => {
          // Mock stop implementation
        },
      };

      const result = builder.transport(transport);
      expect(result).toBe(builder);
    });

    it('should allow complex fluent chaining', () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const promptDef = {
        description: 'Test prompt',
        handler: async () => 'test response',
      };

      const toolDef = {
        description: 'Test tool',
        handler: async () => ({ content: 'test result' }),
      };

      const resourceDef = {
        name: 'Test Resource',
        provider: {
          get: async () => ({ data: 'test' }),
          list: async () => ({ resources: [] }),
        },
      };

      const transport = {
        name: 'test-transport',
        start: async () => {
          // Mock start implementation
        },
        stop: async () => {
          // Mock stop implementation
        },
      };

      const result = builder
        .use(middleware)
        .prompt('test-prompt', promptDef)
        .tool('test-tool', toolDef)
        .resource('test://', resourceDef)
        .transport(transport);

      expect(result).toBe(builder);
    });

    it('should return Promise<void> from .listen()', () => {
      const result = builder.listen();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('lifecycle behavior', () => {
    let builder: McpServerBuilder;

    beforeEach(() => {
      builder = createMcpKitServer();
    });

    it('should start all registered transports with dispatcher', async () => {
      const startedTransports: string[] = [];
      const dispatchFunctions: any[] = [];

      const mockTransport1 = {
        name: 'mock-transport-1',
        start: jest.fn(async (dispatch) => {
          startedTransports.push('mock-transport-1');
          dispatchFunctions.push(dispatch);
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const mockTransport2 = {
        name: 'mock-transport-2',
        start: jest.fn(async (dispatch) => {
          startedTransports.push('mock-transport-2');
          dispatchFunctions.push(dispatch);
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport1).transport(mockTransport2);

      await builder.listen();

      expect(mockTransport1.start).toHaveBeenCalled();
      expect(mockTransport2.start).toHaveBeenCalled();
      expect(startedTransports).toEqual(['mock-transport-1', 'mock-transport-2']);
      expect(dispatchFunctions).toHaveLength(2);
    });

    it('should handle empty transport list when default transport is disabled', async () => {
      builder.noDefaultTransport();
      await expect(builder.listen()).resolves.toBeUndefined();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'middleware',
        method: 'use' as const,
        args: [
          async (_ctx: any, next: () => Promise<void>) => {
            await next();
          },
        ],
      },
      {
        name: 'prompt',
        method: 'prompt' as const,
        args: ['test-prompt', { description: 'Test prompt', handler: async (): Promise<string> => 'test response' }],
      },
      {
        name: 'tool',
        method: 'tool' as const,
        args: ['test-tool', { description: 'Test tool', handler: async (): Promise<{ content: string }> => ({ content: 'test result' }) }],
      },
      {
        name: 'resource',
        method: 'resource' as const,
        args: [
          'test://',
          {
            name: 'Test Resource',
            provider: {
              get: async (): Promise<{ data: string }> => ({ data: 'test' }),
              list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
            },
          },
        ],
      },
    ])('should handle $name registration before listen', async ({ method, args }) => {
      const result = (builder[method] as any)(...args);

      expect(result).toBe(builder);
      builder.noDefaultTransport();
      await expect(builder.listen()).resolves.toBeUndefined();
      expect(typeof builder[method]).toBe('function');
    });

    it('should handle complex registration before listen', async () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const promptDef = {
        description: 'Test prompt',
        handler: async (): Promise<string> => 'test response',
      };

      const toolDef = {
        description: 'Test tool',
        handler: async (): Promise<{ content: string }> => ({ content: 'test result' }),
      };

      const resourceDef = {
        name: 'Test Resource',
        provider: {
          get: async (): Promise<{ data: string }> => ({ data: 'test' }),
          list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
        },
      };

      const transport = {
        name: 'test-transport',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const result = builder
        .use(middleware)
        .prompt('test-prompt', promptDef)
        .tool('test-tool', toolDef)
        .resource('test://', resourceDef)
        .transport(transport);

      expect(result).toBe(builder);

      await expect(builder.listen()).resolves.toBeUndefined();

      expect(transport.start).toHaveBeenCalledTimes(1);
      expect(transport.start).toHaveBeenCalledWith(expect.any(Function));

      expect(typeof builder.use).toBe('function');
      expect(typeof builder.prompt).toBe('function');
      expect(typeof builder.tool).toBe('function');
      expect(typeof builder.resource).toBe('function');
      expect(typeof builder.transport).toBe('function');
      expect(typeof builder.listen).toBe('function');
    });
  });
});
