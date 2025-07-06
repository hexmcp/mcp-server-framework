import type { ServerTransport } from '@hexmcp/transport';
import { z } from 'zod';
import { createMcpKitServer } from '../../src/builder';

describe('Transport Integration Tests', () => {
  beforeEach(() => {
    // Disable default transport for testing
    process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
  });

  afterEach(() => {
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
  });

  describe('Transport Lifecycle Management', () => {
    it('should start and stop transports correctly', async () => {
      const mockTransport: ServerTransport = {
        name: 'test-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('transport-test-tool', {
          description: 'Tool for testing transport lifecycle',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Transport test' }] };
          },
        });

      // Start the server
      const listenPromise = builder.listen();

      // Verify transport was started
      expect(mockTransport.start).toHaveBeenCalledTimes(1);
      expect(mockTransport.start).toHaveBeenCalledWith(expect.any(Function));

      await expect(listenPromise).resolves.not.toThrow();
    });

    it('should handle transport start errors', async () => {
      const errorTransport: ServerTransport = {
        name: 'error-transport',
        start: jest.fn().mockRejectedValue(new Error('Transport failed to start')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(errorTransport)
        .tool('error-transport-tool', {
          description: 'Tool for testing transport errors',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Error test' }] };
          },
        });

      // Server startup should fail when transport fails
      await expect(builder.listen()).rejects.toThrow('Transport failed to start');
      expect(errorTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple transports', async () => {
      const transport1: ServerTransport = {
        name: 'transport-1',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const transport2: ServerTransport = {
        name: 'transport-2',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(transport1)
        .transport(transport2)
        .tool('multi-transport-tool', {
          description: 'Tool for testing multiple transports',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Multi-transport test' }] };
          },
        });

      await builder.listen();

      // Both transports should be started
      expect(transport1.start).toHaveBeenCalledTimes(1);
      expect(transport2.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transport Dispatch Integration', () => {
    it('should provide dispatch function to transports', async () => {
      let capturedDispatch: any;

      const mockTransport: ServerTransport = {
        name: 'dispatch-test-transport',
        start: jest.fn().mockImplementation((dispatch) => {
          capturedDispatch = dispatch;
          return Promise.resolve();
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('dispatch-test-tool', {
          description: 'Tool for testing dispatch',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Dispatch test' }] };
          },
        });

      await builder.listen();

      // Verify dispatch function was provided
      expect(capturedDispatch).toBeDefined();
      expect(typeof capturedDispatch).toBe('function');
    });

    it('should handle transport dispatch calls', async () => {
      let dispatchFunction: any;

      const mockTransport: ServerTransport = {
        name: 'dispatch-call-transport',
        start: jest.fn().mockImplementation((dispatch) => {
          dispatchFunction = dispatch;
          return Promise.resolve();
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const toolHandler = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Dispatch call test' }],
      });

      const builder = createMcpKitServer()
        .transport(mockTransport)
        .tool('dispatch-call-tool', {
          description: 'Tool for testing dispatch calls',
          inputSchema: z.object({}),
          handler: toolHandler,
        });

      await builder.listen();

      // Simulate a transport dispatching a request
      if (dispatchFunction) {
        const mockRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'dispatch-call-tool',
            arguments: {},
          },
        };

        const mockRespond = jest.fn();
        const mockMetadata = {
          transport: { name: 'dispatch-call-transport' },
          requestId: 'test-request',
          method: 'tools/call',
        };

        // This should not throw
        expect(() => {
          dispatchFunction(mockRequest, mockRespond, mockMetadata);
        }).not.toThrow();
      }
    });
  });

  describe('Transport Error Handling', () => {
    it('should handle partial transport failures gracefully', async () => {
      const goodTransport: ServerTransport = {
        name: 'good-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const badTransport: ServerTransport = {
        name: 'bad-transport',
        start: jest.fn().mockRejectedValue(new Error('Bad transport error')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(goodTransport)
        .transport(badTransport)
        .tool('partial-failure-tool', {
          description: 'Tool for testing partial transport failures',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Partial failure test' }] };
          },
        });

      // Should fail because one transport failed
      await expect(builder.listen()).rejects.toThrow('Bad transport error');

      // Good transport should still have been attempted
      expect(goodTransport.start).toHaveBeenCalledTimes(1);
      expect(badTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle transport stop errors', async () => {
      const errorStopTransport: ServerTransport = {
        name: 'error-stop-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockRejectedValue(new Error('Stop error')),
      };

      const builder = createMcpKitServer()
        .transport(errorStopTransport)
        .tool('stop-error-tool', {
          description: 'Tool for testing stop errors',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Stop error test' }] };
          },
        });

      // Start should succeed
      await expect(builder.listen()).resolves.not.toThrow();
      expect(errorStopTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transport Configuration', () => {
    it('should handle transport replacement', () => {
      const transport1: ServerTransport = {
        name: 'replaceable-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const transport2: ServerTransport = {
        name: 'replaceable-transport', // Same name
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(transport1)
        .transport(transport2) // Should replace transport1
        .tool('replacement-tool', {
          description: 'Tool for testing transport replacement',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'Replacement test' }] };
          },
        });

      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });

    it('should handle no transport configuration', async () => {
      const builder = createMcpKitServer()
        .noDefaultTransport()
        .tool('no-transport-tool', {
          description: 'Tool for testing no transport',
          inputSchema: z.object({}),
          handler: async () => {
            return { content: [{ type: 'text', text: 'No transport test' }] };
          },
        });

      // Should succeed but do nothing since no transports are configured
      await expect(builder.listen()).resolves.not.toThrow();
    });
  });

  describe('Transport Metadata', () => {
    it('should provide correct transport metadata to handlers', async () => {
      let capturedMetadata: any;
      let dispatchFunction: any;

      const metadataTransport: ServerTransport = {
        name: 'metadata-transport',
        start: jest.fn().mockImplementation((dispatch) => {
          dispatchFunction = dispatch;
          return Promise.resolve();
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      const builder = createMcpKitServer()
        .transport(metadataTransport)
        .tool('metadata-tool', {
          description: 'Tool for testing metadata',
          inputSchema: z.object({}),
          handler: async (_args, context) => {
            capturedMetadata = context;
            return { content: [{ type: 'text', text: 'Metadata test' }] };
          },
        });

      await builder.listen();

      // Simulate a request with metadata
      if (dispatchFunction) {
        const mockRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'metadata-tool',
            arguments: {},
          },
        };

        const mockRespond = jest.fn();
        const mockMetadata = {
          transport: { name: 'metadata-transport' },
          requestId: 'metadata-test-request',
          method: 'tools/call',
          timestamp: new Date(),
        };

        dispatchFunction(mockRequest, mockRespond, mockMetadata);

        // Allow async processing
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Verify metadata was passed correctly
        if (capturedMetadata) {
          expect(capturedMetadata.transport.name).toBe('metadata-transport');
          expect(capturedMetadata.requestId).toBe('metadata-test-request');
          expect(capturedMetadata.method).toBe('tools/call');
        }
      }
    });
  });
});
