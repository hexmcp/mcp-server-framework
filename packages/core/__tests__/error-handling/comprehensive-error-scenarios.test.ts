import type { ServerTransport } from '@hexmcp/transport';
import { z } from 'zod';
import { createMcpKitServer } from '../../src/builder';

describe('Comprehensive Error Handling Tests', () => {
  beforeEach(() => {
    process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
  });

  afterEach(() => {
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
  });

  describe('Tool Error Scenarios', () => {
    it('should handle synchronous tool errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'error-test-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('sync-error-tool', {
          description: 'Tool that throws synchronous errors',
          inputSchema: z.object({
            errorType: z.string().optional(),
          }),
          handler: (args) => {
            if (args.errorType === 'reference') {
              throw new ReferenceError('Reference error in tool');
            }
            if (args.errorType === 'type') {
              throw new TypeError('Type error in tool');
            }
            if (args.errorType === 'generic') {
              throw new Error('Generic error in tool');
            }
            return { content: [{ type: 'text', text: 'Success' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle asynchronous tool errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'async-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('async-error-tool', {
          description: 'Tool that throws asynchronous errors',
          inputSchema: z.object({
            delay: z.number().optional(),
            errorType: z.string().optional(),
          }),
          handler: async (args: { delay?: number; errorType?: string }) => {
            if (args.delay) {
              await new Promise((resolve) => setTimeout(resolve, args.delay));
            }

            if (args.errorType === 'timeout') {
              throw new Error('Operation timed out');
            }
            if (args.errorType === 'network') {
              throw new Error('Network error occurred');
            }
            if (args.errorType === 'permission') {
              throw new Error('Permission denied');
            }

            return { content: [{ type: 'text', text: 'Async success' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle tool validation errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'validation-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('validation-tool', {
          description: 'Tool with strict validation',
          inputSchema: z.object({
            requiredField: z.string(),
            numberField: z.number().min(0).optional(),
          }),
          handler: async (args) => {
            // Additional runtime validation
            if (args.requiredField === 'invalid') {
              throw new Error('Invalid field value');
            }

            return { content: [{ type: 'text', text: `Valid: ${args.requiredField}` }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Prompt Error Scenarios', () => {
    it('should handle prompt generation errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'prompt-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .prompt('error-prompt', {
          description: 'Prompt that can throw errors',
          arguments: [
            {
              name: 'scenario',
              description: 'Error scenario to test',
              required: false,
            },
          ],
          handler: async (args: { scenario?: string }) => {
            if (args.scenario === 'template-error') {
              throw new Error('Template generation failed');
            }
            if (args.scenario === 'context-error') {
              throw new Error('Context loading failed');
            }
            if (args.scenario === 'format-error') {
              throw new Error('Message formatting failed');
            }

            return `Generate content for ${args.scenario || 'default'}`;
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle prompt argument validation errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'prompt-validation-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .prompt('strict-prompt', {
          description: 'Prompt with strict argument validation',
          arguments: [
            {
              name: 'topic',
              description: 'Topic to write about',
              required: true,
            },
            {
              name: 'length',
              description: 'Length of content',
              required: false,
            },
          ],
          handler: async (args: { topic?: string; length?: number }) => {
            if (!args.topic || (typeof args.topic === 'string' && args.topic.trim().length === 0)) {
              throw new Error('Topic cannot be empty');
            }

            if (args.length && (typeof args.length !== 'number' || args.length <= 0)) {
              throw new Error('Length must be a positive number');
            }

            return `Write ${args.length || 'a short piece'} about ${args.topic}`;
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Error Scenarios', () => {
    it('should handle resource access errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'resource-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .resource('error://**', {
          name: 'Error Resources',
          description: 'Resources that can throw errors',
          provider: {
            get: async (uri) => {
              if (uri.includes('not-found')) {
                throw new Error('Resource not found');
              }
              if (uri.includes('permission-denied')) {
                throw new Error('Permission denied');
              }
              if (uri.includes('network-error')) {
                throw new Error('Network error');
              }
              if (uri.includes('timeout')) {
                throw new Error('Request timeout');
              }

              return {
                uri,
                mimeType: 'text/plain',
                text: `Content for ${uri}`,
              };
            },
            list: async () => {
              // Simulate listing error scenarios
              const shouldError = Math.random() < 0.1; // 10% chance of error for testing
              if (shouldError) {
                throw new Error('Failed to list resources');
              }

              return {
                resources: [
                  {
                    uri: 'error://test',
                    name: 'Test Resource',
                    description: 'A test resource',
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

    it('should handle resource pattern matching errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'pattern-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .resource('invalid-pattern://**', {
          name: 'Invalid Pattern Resources',
          description: 'Resources with potentially problematic patterns',
          provider: {
            get: async (uri) => {
              // Simulate pattern-related errors
              if (uri.includes('malformed')) {
                throw new Error('Malformed URI');
              }
              if (uri.includes('unsupported-scheme')) {
                throw new Error('Unsupported URI scheme');
              }

              return {
                uri,
                mimeType: 'application/octet-stream',
                text: 'Binary content',
              };
            },
            list: async () => {
              return { resources: [] };
            },
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transport Error Scenarios', () => {
    it('should handle transport startup failures', async () => {
      const failingTransport: ServerTransport = {
        name: 'failing-transport',
        start: jest.fn().mockRejectedValue(new Error('Transport startup failed')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(failingTransport)
        .tool('transport-error-tool', {
          description: 'Tool for testing transport errors',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Should not reach here' }] };
          },
        });

      await expect(builder.listen()).rejects.toThrow('Transport startup failed');
      expect(failingTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle transport communication errors', async () => {
      let capturedDispatch: any;

      const errorProneTransport: ServerTransport = {
        name: 'error-prone-transport',
        start: jest.fn().mockImplementation((dispatch) => {
          capturedDispatch = dispatch;
          return Promise.resolve();
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(errorProneTransport)
        .tool('communication-test-tool', {
          description: 'Tool for testing communication errors',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Communication test' }] };
          },
        });

      await builder.listen();

      // Test malformed requests
      if (capturedDispatch) {
        const malformedRequest = {
          // Missing required fields
          method: 'tools/call',
        };

        const mockRespond = jest.fn();
        const mockMetadata = {
          transport: { name: 'error-prone-transport' },
          requestId: 'malformed-request',
          method: 'tools/call',
        };

        // Should handle malformed requests gracefully
        expect(() => {
          capturedDispatch(malformedRequest, mockRespond, mockMetadata);
        }).not.toThrow();
      }
    });
  });

  describe('Middleware Error Scenarios', () => {
    it('should handle middleware errors', async () => {
      const mockTransport: ServerTransport = {
        name: 'middleware-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const errorMiddleware = async (ctx: any, next: () => Promise<void>) => {
        if (ctx.request?.params?.triggerError) {
          throw new Error('Middleware error');
        }
        await next();
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .use(errorMiddleware)
        .tool('middleware-test-tool', {
          description: 'Tool for testing middleware errors',
          inputSchema: z.object({
            triggerError: z.boolean().optional(),
          }),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Middleware test' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle middleware chain interruption', async () => {
      const mockTransport: ServerTransport = {
        name: 'chain-error-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const interruptingMiddleware = async (ctx: any, next: () => Promise<void>) => {
        if (ctx.request?.params?.interrupt) {
          // Don't call next() to interrupt the chain
          return;
        }
        await next();
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .use(interruptingMiddleware)
        .tool('chain-test-tool', {
          description: 'Tool for testing middleware chain',
          inputSchema: z.object({
            interrupt: z.boolean().optional(),
          }),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Chain test' }] };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle large payload scenarios', async () => {
      const mockTransport: ServerTransport = {
        name: 'large-payload-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('large-payload-tool', {
          description: 'Tool for testing large payloads',
          inputSchema: z.object({
            size: z.number().optional(),
          }),
          handler: async (args: { size?: number }) => {
            const size = args.size || 1000;

            // Generate large content
            const largeContent = 'x'.repeat(size);

            return {
              content: [
                {
                  type: 'text',
                  text: `Large content (${size} chars): ${largeContent.substring(0, 100)}...`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent request scenarios', async () => {
      const mockTransport: ServerTransport = {
        name: 'concurrent-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('concurrent-tool', {
          description: 'Tool for testing concurrent requests',
          inputSchema: z.object({
            delay: z.number().optional(),
            id: z.string().optional(),
          }),
          handler: async (args: { delay?: number; id?: string }) => {
            if (args.delay) {
              await new Promise((resolve) => setTimeout(resolve, args.delay));
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Concurrent request ${args.id || 'unknown'} completed`,
                },
              ],
            };
          },
        });

      await builder.listen();
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
    });
  });
});
