import type { ServerTransport } from '@hexmcp/transport';
import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

describe('Backward Compatibility', () => {
  let builder: McpServerBuilder;

  beforeEach(() => {
    builder = createMcpKitServer();
  });

  describe('existing explicit transport patterns', () => {
    it('should work with single explicit transport (existing pattern)', async () => {
      const mockTransport: ServerTransport = {
        name: 'stdio',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport);
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
      expect(mockTransport.start).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should work with multiple explicit transports (existing pattern)', async () => {
      const mockTransport1: ServerTransport = {
        name: 'stdio',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const mockTransport2: ServerTransport = {
        name: 'http',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport1).transport(mockTransport2);
      await builder.listen();

      expect(mockTransport1.start).toHaveBeenCalledTimes(1);
      expect(mockTransport2.start).toHaveBeenCalledTimes(1);
    });

    it('should work with complex builder chain (existing pattern)', async () => {
      const mockTransport: ServerTransport = {
        name: 'custom',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const result = builder
        .use(middleware)
        .tool('test-tool', {
          description: 'Test tool',
          handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        })
        .resource('test://**', {
          description: 'Test resource',
          provider: {
            get: async () => 'test resource content',
            list: async () => ({ resources: [] }),
          },
        })
        .prompt('test-prompt', {
          description: 'Test prompt',
          handler: async () => 'test prompt content',
        })
        .transport(mockTransport);

      expect(result).toBe(builder);
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('API surface compatibility', () => {
    it('should maintain all existing builder methods', () => {
      expect(typeof builder.use).toBe('function');
      expect(typeof builder.tool).toBe('function');
      expect(typeof builder.resource).toBe('function');
      expect(typeof builder.prompt).toBe('function');
      expect(typeof builder.transport).toBe('function');
      expect(typeof builder.listen).toBe('function');
    });

    it('should maintain fluent chaining for all methods', () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const mockTransport: ServerTransport = {
        name: 'test',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const result = builder
        .use(middleware)
        .tool('test', {
          description: 'Test',
          handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        })
        .resource('test://**', {
          description: 'Test',
          provider: {
            get: async () => 'test',
            list: async () => ({ resources: [] }),
          },
        })
        .prompt('test', {
          description: 'Test',
          handler: async () => 'test',
        })
        .transport(mockTransport);

      expect(result).toBe(builder);
    });

    it('should return Promise<void> from listen() method', () => {
      const mockTransport: ServerTransport = {
        name: 'test',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport);
      const result = builder.listen();

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('transport interface compatibility', () => {
    it('should call transport.start() with dispatcher function', async () => {
      const mockTransport: ServerTransport = {
        name: 'test',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport);
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
      expect(mockTransport.start).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle transport start errors the same way', async () => {
      const mockTransport: ServerTransport = {
        name: 'failing-transport',
        start: jest.fn(async () => {
          throw new Error('Transport start failed');
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport);

      await expect(builder.listen()).rejects.toThrow('Transport start failed');
    });

    it('should work with custom transport implementations', async () => {
      class CustomTransport implements ServerTransport {
        readonly name = 'custom-class-transport';
        private started = false;

        async start(_dispatch: any): Promise<void> {
          this.started = true;
        }

        async stop(): Promise<void> {
          this.started = false;
        }

        isStarted(): boolean {
          return this.started;
        }
      }

      const customTransport = new CustomTransport();
      builder.transport(customTransport);
      await builder.listen();

      expect(customTransport.isStarted()).toBe(true);
    });
  });

  describe('middleware and registry compatibility', () => {
    it('should work with existing middleware patterns', async () => {
      const middlewareCallOrder: string[] = [];

      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        middlewareCallOrder.push('middleware1-before');
        await next();
        middlewareCallOrder.push('middleware1-after');
      };

      const middleware2 = async (_ctx: any, next: () => Promise<void>) => {
        middlewareCallOrder.push('middleware2-before');
        await next();
        middlewareCallOrder.push('middleware2-after');
      };

      const mockTransport: ServerTransport = {
        name: 'test',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.use(middleware1).use(middleware2).transport(mockTransport);

      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should work with existing tool/resource/prompt registration', async () => {
      const mockTransport: ServerTransport = {
        name: 'test',
        start: jest.fn(async () => {
          // Mock stop implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder
        .tool('existing-tool', {
          description: 'Existing tool pattern',
          handler: async () => ({ content: [{ type: 'text', text: 'existing' }] }),
        })
        .resource('existing://**', {
          description: 'Existing resource pattern',
          provider: {
            get: async () => 'existing resource',
            list: async () => ({ resources: [] }),
          },
        })
        .prompt('existing-prompt', {
          description: 'Existing prompt pattern',
          handler: async () => 'existing prompt',
        })
        .transport(mockTransport);

      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });
});
