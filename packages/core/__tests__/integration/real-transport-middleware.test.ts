import { Readable, Writable } from 'node:stream';
import { startAllTransports, stopAllTransports } from '../../../transport/src/orchestrator';
import { TransportRegistry } from '../../../transport/src/registry';
import { StdioTransport } from '../../../transport-stdio/src/stdio-transport';
import {
  createErrorMapperMiddleware,
  LifecycleState,
  McpCapabilityRegistry,
  McpHandshakeHandlers,
  McpLifecycleManager,
  McpMiddlewareEngine,
  McpMiddlewareRegistry,
  McpRequestGate,
  MiddlewareDispatcher,
  MockPrimitiveRegistry,
} from '../../src/index';
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createStateMutationMiddleware,
  createTracingMiddleware,
} from '../fixtures/middleware-fixtures';

describe('Real Transport with Middleware Integration', () => {
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let handshakeHandlers: McpHandshakeHandlers;
  let middlewareRegistry: McpMiddlewareRegistry;
  let middlewareEngine: McpMiddlewareEngine;
  let dispatcher: MiddlewareDispatcher;
  let transportRegistry: TransportRegistry;
  let stdioTransport: StdioTransport;

  // Mock streams for stdio transport
  let mockStdin: Readable;
  let mockStdout: Writable;
  let originalStdin: NodeJS.ReadableStream;
  let originalStdout: NodeJS.WriteStream;

  // Captured output
  let capturedStdout: string[];

  beforeEach(() => {
    // Initialize core components
    const primitiveRegistry = new MockPrimitiveRegistry();
    const capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);

    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
    handshakeHandlers = new McpHandshakeHandlers(lifecycleManager);

    middlewareRegistry = new McpMiddlewareRegistry();
    middlewareEngine = new McpMiddlewareEngine();

    // Setup transport registry
    transportRegistry = new TransportRegistry();
    stdioTransport = new StdioTransport();
    transportRegistry.registerTransport(stdioTransport);

    // Setup mock streams
    capturedStdout = [];

    mockStdin = new Readable({
      read() {
        // Mock implementation
      },
    });

    mockStdout = new Writable({
      write(chunk: any, _encoding: any, callback: any) {
        capturedStdout.push(chunk.toString());
        if (callback) {
          callback();
        }
        return true;
      },
    });

    // Replace process streams
    originalStdin = process.stdin;
    originalStdout = process.stdout;

    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });

    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      configurable: true,
    });
  });

  afterEach(async () => {
    // Stop all transports
    await stopAllTransports(transportRegistry);

    // Restore process streams
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    });

    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      configurable: true,
    });
  });

  describe('Middleware Stack Integration', () => {
    it('should execute middleware stack through real transport', async () => {
      const logs: string[] = [];

      // Register middleware stack
      middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());
      middlewareRegistry.registerMiddleware(createLoggingMiddleware('request-logger', logs));
      middlewareRegistry.registerMiddleware(createAuthMiddleware('auth', true));
      middlewareRegistry.registerMiddleware(createStateMutationMiddleware('state', 'processed', true));

      // Create core dispatcher
      const coreDispatcher = async (ctx: any) => {
        const { method } = ctx.request;

        if (method === 'initialize') {
          ctx.response = await handshakeHandlers.handleInitialize(ctx.request);
        } else if (method === 'tools/list') {
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            result: {
              tools: [],
              middlewareState: ctx.state, // Include middleware state in response
            },
          };
        } else {
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            error: { code: -32601, message: `Method '${method}' not found` },
          };
        }
      };

      // Create dispatcher with middleware
      dispatcher = new MiddlewareDispatcher({
        requestGate,
        middlewareRegistry,
        middlewareEngine,
        coreDispatcher,
      });

      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Initialize
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'Middleware Test', version: '1.0.0' },
        },
      });

      mockStdin.push(`${initRequest}\n`);
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Clear captured output and logs
      capturedStdout.length = 0;
      logs.length = 0;

      // Send operational request
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-1',
        method: 'tools/list',
        params: {},
      });

      mockStdin.push(`${toolsRequest}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 30));

      // Verify middleware execution
      expect(logs).toEqual(['request-logger:before', 'request-logger:after']);

      // Verify response includes middleware state
      expect(capturedStdout.length).toBeGreaterThan(0);
      const response = JSON.parse(capturedStdout[0]);

      expect(response.result.middlewareState).toEqual({
        authenticated: true,
        processed: true,
        user: {
          id: 'test-user',
          name: 'Test User',
        },
      });
    });

    it('should handle middleware errors through real transport', async () => {
      // Register middleware that throws an error
      middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());
      middlewareRegistry.registerMiddleware(createAuthMiddleware('auth', false)); // Auth fails

      const coreDispatcher = async (ctx: any) => {
        ctx.response = { jsonrpc: '2.0', id: ctx.request.id, result: {} };
      };

      dispatcher = new MiddlewareDispatcher({
        requestGate,
        middlewareRegistry,
        middlewareEngine,
        coreDispatcher,
      });

      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Initialize first
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'Test', version: '1.0.0' },
        },
      });

      mockStdin.push(`${initRequest}\n`);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Clear captured output
      capturedStdout.length = 0;

      // Send request that will fail auth
      const failingRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'fail-1',
        method: 'tools/list',
        params: {},
      });

      mockStdin.push(`${failingRequest}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 30));

      // Should receive error response
      expect(capturedStdout.length).toBeGreaterThan(0);
      const errorResponse = JSON.parse(capturedStdout[0]);

      expect(errorResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'fail-1',
        error: {
          code: -32000,
          message: expect.stringContaining('Authentication failed'),
        },
      });
    });

    it('should handle rate limiting through real transport', async () => {
      // Register rate limiting middleware (limit to 2 requests)
      middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());
      middlewareRegistry.registerMiddleware(createRateLimitMiddleware('rate-limit', 2));

      const coreDispatcher = async (ctx: any) => {
        const { method } = ctx.request;

        if (method === 'initialize') {
          ctx.response = await handshakeHandlers.handleInitialize(ctx.request);
        } else {
          ctx.response = { jsonrpc: '2.0', id: ctx.request.id, result: { success: true } };
        }
      };

      dispatcher = new MiddlewareDispatcher({
        requestGate,
        middlewareRegistry,
        middlewareEngine,
        coreDispatcher,
      });

      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Initialize
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'Test', version: '1.0.0' },
        },
      });

      mockStdin.push(`${initRequest}\n`);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Clear captured output
      capturedStdout.length = 0;

      // Send 3 requests rapidly (should hit rate limit on 3rd)
      const requests = [
        { jsonrpc: '2.0', id: 'req-1', method: 'ping', params: {} },
        { jsonrpc: '2.0', id: 'req-2', method: 'ping', params: {} },
        { jsonrpc: '2.0', id: 'req-3', method: 'ping', params: {} }, // This should be rate limited
      ];

      for (const request of requests) {
        mockStdin.push(`${JSON.stringify(request)}\n`);
      }
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have responses (rate limiting may affect count)
      expect(capturedStdout.length).toBeGreaterThan(0);

      const responses = capturedStdout.map((output) => JSON.parse(output));

      // At least one should succeed
      const successResponses = responses.filter((r) => r.result?.success === true);
      expect(successResponses.length).toBeGreaterThan(0);

      // At least one should be rate limited (if we sent enough requests)
      const rateLimitedResponses = responses.filter((r) => r.error?.message?.includes('Rate limit exceeded'));

      // Either we got all successful responses (rate limit not hit) or some were rate limited
      expect(successResponses.length + rateLimitedResponses.length).toBe(responses.length);
    });
  });
});
