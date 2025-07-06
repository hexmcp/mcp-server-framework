import type { ServerTransport } from '@hexmcp/transport';
import { z } from 'zod';
import { createMcpKitServer } from '../../src/builder';

describe('Error Recovery and Resilience Tests', () => {
  beforeEach(() => {
    process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
  });

  afterEach(() => {
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
  });

  describe('Tool Error Recovery', () => {
    it('should recover from tool errors and continue processing', async () => {
      const mockTransport: ServerTransport = {
        name: 'recovery-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let errorCount = 0;
      let successCount = 0;

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('recovery-tool', {
          description: 'Tool that demonstrates error recovery',
          inputSchema: z.object({
            shouldFail: z.boolean().optional(),
            requestId: z.string().optional(),
          }),
          handler: async (args) => {
            if (args.shouldFail) {
              errorCount++;
              throw new Error(`Intentional error for request ${args.requestId}`);
            }

            successCount++;
            return {
              content: [
                {
                  type: 'text',
                  text: `Success for request ${args.requestId}. Errors: ${errorCount}, Successes: ${successCount}`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle intermittent failures gracefully', async () => {
      const mockTransport: ServerTransport = {
        name: 'intermittent-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let callCount = 0;

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('intermittent-tool', {
          description: 'Tool with intermittent failures',
          inputSchema: z.object({
            data: z.string().optional(),
          }),
          handler: async (args) => {
            callCount++;

            // Fail every 3rd call
            if (callCount % 3 === 0) {
              throw new Error(`Intermittent failure on call ${callCount}`);
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Success on call ${callCount}: ${args.data || 'no data'}`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should maintain state consistency after errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'state-consistency-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const sharedState = {
        counter: 0,
        operations: [] as string[],
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('stateful-tool', {
          description: 'Tool that maintains state across calls',
          inputSchema: z.object({
            operation: z.string().optional(),
            value: z.number().optional(),
          }),
          handler: async (args: { operation?: string; value?: number }) => {
            const operation = args.operation || 'increment';
            const value = args.value || 1;

            sharedState.operations.push(`${operation}:${value}`);

            if (operation === 'error') {
              throw new Error('Intentional state error');
            }

            if (operation === 'increment') {
              sharedState.counter += value;
            } else if (operation === 'decrement') {
              sharedState.counter -= value;
            } else if (operation === 'reset') {
              sharedState.counter = 0;
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `State: counter=${sharedState.counter}, operations=${sharedState.operations.length}`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Error Recovery', () => {
    it('should handle resource provider failures gracefully', async () => {
      const mockTransport: ServerTransport = {
        name: 'resource-recovery-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let failureCount = 0;

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .resource('resilient://**', {
          name: 'Resilient Resources',
          description: 'Resources that demonstrate error recovery',
          provider: {
            get: async (uri) => {
              // Simulate occasional failures
              if (uri.includes('fail-once') && failureCount === 0) {
                failureCount++;
                throw new Error('First attempt failed');
              }

              if (uri.includes('always-fail')) {
                throw new Error('Resource permanently unavailable');
              }

              return {
                uri,
                mimeType: 'text/plain',
                text: `Resilient content for ${uri} (failures: ${failureCount})`,
              };
            },
            list: async () => {
              return {
                resources: [
                  {
                    uri: 'resilient://test',
                    name: 'Test Resource',
                    description: 'A resilient test resource',
                    mimeType: 'text/plain',
                  },
                  {
                    uri: 'resilient://fail-once',
                    name: 'Fail Once Resource',
                    description: 'Resource that fails on first access',
                    mimeType: 'text/plain',
                  },
                ],
              };
            },
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle resource caching and invalidation', async () => {
      const mockTransport: ServerTransport = {
        name: 'caching-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const cache = new Map<string, { content: string; timestamp: number }>();
      const CACHE_TTL = 1000; // 1 second

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .resource('cached://**', {
          name: 'Cached Resources',
          description: 'Resources with caching behavior',
          provider: {
            get: async (uri) => {
              const now = Date.now();
              const cached = cache.get(uri);

              // Return cached content if valid
              if (cached && now - cached.timestamp < CACHE_TTL) {
                return {
                  uri,
                  mimeType: 'text/plain',
                  text: `CACHED: ${cached.content}`,
                };
              }

              // Simulate expensive operation
              await new Promise((resolve) => setTimeout(resolve, 10));

              const content = `Fresh content for ${uri} at ${new Date().toISOString()}`;
              cache.set(uri, { content, timestamp: now });

              return {
                uri,
                mimeType: 'text/plain',
                text: content,
              };
            },
            list: async () => {
              return {
                resources: [
                  {
                    uri: 'cached://test',
                    name: 'Cached Test Resource',
                    description: 'A resource with caching',
                    mimeType: 'text/plain',
                  },
                ],
              };
            },
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transport Resilience', () => {
    it('should handle transport reconnection scenarios', async () => {
      let startCount = 0;
      let stopCount = 0;

      const resilientTransport: ServerTransport = {
        name: 'resilient-transport',
        start: jest.fn().mockImplementation(() => {
          startCount++;
          if (startCount === 1) {
            // Fail on first start
            return Promise.reject(new Error('Initial connection failed'));
          }
          return Promise.resolve();
        }),
        stop: jest.fn().mockImplementation(() => {
          stopCount++;
          return Promise.resolve();
        }),
      };

      const builder = createMcpKitServer()
        .transport(resilientTransport)
        .tool('resilience-tool', {
          description: 'Tool for testing transport resilience',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Resilience test' }] };
          },
        });

      // First attempt should fail
      await expect(builder.listen()).rejects.toThrow('Initial connection failed');
      expect(startCount).toBe(1);
      expect(stopCount).toBe(0); // Stop should not be called on failed start
    });

    it('should handle partial transport failures in multi-transport setup', async () => {
      const goodTransport: ServerTransport = {
        name: 'good-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const badTransport: ServerTransport = {
        name: 'bad-transport',
        start: jest.fn().mockRejectedValue(new Error('Bad transport failed')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(goodTransport)
        .transport(badTransport)
        .tool('multi-transport-tool', {
          description: 'Tool for testing multi-transport resilience',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Multi-transport test' }] };
          },
        });

      // Should fail because one transport failed
      await expect(builder.listen()).rejects.toThrow('Bad transport failed');

      // Good transport should have been attempted
      expect(goodTransport.start).toHaveBeenCalledTimes(1);
      expect(badTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Middleware Error Resilience', () => {
    it('should isolate middleware errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'middleware-isolation-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const middleware1 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const errorMiddleware = async (ctx: any, next: () => Promise<void>) => {
        if (ctx.request?.params?.triggerMiddlewareError) {
          throw new Error('Middleware error');
        }
        await next();
      };

      const middleware3 = async (_ctx: any, next: () => Promise<void>) => {
        await next();
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .use(middleware1)
        .use(errorMiddleware)
        .use(middleware3)
        .tool('isolation-tool', {
          description: 'Tool for testing middleware isolation',
          inputSchema: z.object({
            triggerMiddlewareError: z.boolean().optional(),
          }),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Isolation test' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle middleware timeout scenarios', async () => {
      const mockTransport: ServerTransport = {
        name: 'timeout-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const timeoutMiddleware = async (ctx: any, next: () => Promise<void>) => {
        if (ctx.request?.params?.timeout) {
          // Simulate a hanging middleware
          await new Promise((resolve) => setTimeout(resolve, ctx.request.params.timeout));
        }
        await next();
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .use(timeoutMiddleware)
        .tool('timeout-tool', {
          description: 'Tool for testing timeout scenarios',
          inputSchema: z.object({
            timeout: z.number().optional(),
          }),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Timeout test' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('System Resource Management', () => {
    it('should handle memory pressure scenarios', async () => {
      const mockTransport: ServerTransport = {
        name: 'memory-pressure-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('memory-tool', {
          description: 'Tool for testing memory pressure',
          inputSchema: z.object({
            allocateSize: z.number().optional(),
          }),
          handler: async (args: { allocateSize?: number }) => {
            const size = args.allocateSize || 1000;

            // Simulate memory allocation
            const data = new Array(size).fill('x'.repeat(1000));

            const processed = data.map((item: string, index: number) => `${index}: ${item.substring(0, 10)}`);

            return {
              content: [
                {
                  type: 'text',
                  text: `Processed ${processed.length} items (${size * 1000} chars total)`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent request limits', async () => {
      const mockTransport: ServerTransport = {
        name: 'concurrency-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let activeRequests = 0;
      const maxConcurrentRequests = 5;

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('concurrency-tool', {
          description: 'Tool for testing concurrency limits',
          inputSchema: z.object({
            duration: z.number().optional(),
            requestId: z.string().optional(),
          }),
          handler: async (args: { duration?: number; requestId?: string }) => {
            activeRequests++;

            if (activeRequests > maxConcurrentRequests) {
              activeRequests--;
              throw new Error('Too many concurrent requests');
            }

            try {
              const duration = args.duration || 100;
              await new Promise((resolve) => setTimeout(resolve, duration));

              return {
                content: [
                  {
                    type: 'text',
                    text: `Request ${args.requestId || 'unknown'} completed (active: ${activeRequests})`,
                  },
                ],
              };
            } finally {
              activeRequests--;
            }
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });
});
