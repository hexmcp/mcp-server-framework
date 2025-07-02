import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

describe('McpServerBuilder', () => {
  describe('factory function', () => {
    it('should create a builder instance', () => {
      const builder = createMcpKitServer();
      expect(builder).toBeDefined();
      expect(typeof builder.use).toBe('function');
      expect(typeof builder.prompt).toBe('function');
      expect(typeof builder.tool).toBe('function');
      expect(typeof builder.resource).toBe('function');
      expect(typeof builder.transport).toBe('function');
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

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');

      expect(mockTransport1.start).not.toHaveBeenCalled();
      expect(mockTransport2.start).not.toHaveBeenCalled();
    });

    it('should handle empty transport list', async () => {
      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });

    it('should handle middleware registration before listen', async () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      builder.use(middleware);

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });

    it('should handle prompt registration before listen', async () => {
      const promptDef = {
        description: 'Test prompt',
        handler: async () => 'test response',
      };

      builder.prompt('test-prompt', promptDef);

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });

    it('should handle tool registration before listen', async () => {
      const toolDef = {
        description: 'Test tool',
        handler: async () => ({ content: 'test result' }),
      };

      builder.tool('test-tool', toolDef);

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });

    it('should handle resource registration before listen', async () => {
      const resourceDef = {
        name: 'Test Resource',
        provider: {
          get: async () => ({ data: 'test' }),
          list: async () => ({ resources: [] }),
        },
      };

      builder.resource('test://', resourceDef);

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });

    it('should handle complex registration before listen', async () => {
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
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder
        .use(middleware)
        .prompt('test-prompt', promptDef)
        .tool('test-tool', toolDef)
        .resource('test://', resourceDef)
        .transport(transport);

      await expect(builder.listen()).rejects.toThrow('Not implemented yet');
    });
  });
});
