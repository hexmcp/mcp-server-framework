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

describe('Real Transport Integration Tests', () => {
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

    // Note: No logging middleware to avoid stdout pollution in real transport tests
    middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());

    // Create core dispatcher
    const coreDispatcher = async (ctx: any) => {
      const { method } = ctx.request;

      if (method === 'initialize') {
        ctx.response = await handshakeHandlers.handleInitialize(ctx.request);
      } else if (method === 'notifications/initialized') {
        await handshakeHandlers.handleInitialized(ctx.request);
        // No response for notifications
      } else if (method === 'tools/list') {
        ctx.response = { jsonrpc: '2.0', id: ctx.request.id, result: { tools: [] } };
      } else if (method === 'ping') {
        ctx.response = { jsonrpc: '2.0', id: ctx.request.id, result: {} };
      } else {
        ctx.response = {
          jsonrpc: '2.0',
          id: ctx.request.id,
          error: { code: -32601, message: `Method '${method}' not found` },
        };
      }
    };

    // Create middleware dispatcher
    dispatcher = new MiddlewareDispatcher({
      requestGate,
      middlewareRegistry,
      middlewareEngine,
      coreDispatcher,
    });

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

  describe('Real Stdio Transport Integration', () => {
    it('should handle complete MCP handshake through real stdio transport', async () => {
      // Start the real transport with our dispatcher
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Send initialize request through real transport
      const initializeRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Real Transport Test Client', version: '1.0.0' },
        },
      });

      // Simulate client sending message via stdin
      mockStdin.push(`${initializeRequest}\n`);
      mockStdin.push(null); // End stream

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify response was written to stdout
      expect(capturedStdout.length).toBeGreaterThan(0);

      const responseJson = capturedStdout[0];
      expect(responseJson).toBeDefined();
      const response = JSON.parse(responseJson as string);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'init-1',
        result: {
          protocolVersion: '2025-06-18',
          capabilities: expect.any(Object),
          serverInfo: {
            name: 'MCP Server Framework',
            version: '1.0.0',
          },
        },
      });

      // Verify lifecycle state
      expect(lifecycleManager.currentState).toBe(LifecycleState.READY);
    });

    it('should handle operational requests through real transport after initialization', async () => {
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // First initialize
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

      // Send operational request
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-1',
        method: 'tools/list',
        params: {},
      });

      mockStdin.push(`${toolsRequest}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify tools response
      expect(capturedStdout.length).toBeGreaterThan(0);
      const toolsResponseJson = capturedStdout[0];
      expect(toolsResponseJson).toBeDefined();
      const toolsResponse = JSON.parse(toolsResponseJson as string);

      expect(toolsResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'tools-1',
        result: {
          tools: [],
        },
      });
    });

    it('should reject operational requests before initialization through real transport', async () => {
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Send operational request without initialization
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-before-init',
        method: 'tools/list',
        params: {},
      });

      mockStdin.push(`${toolsRequest}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify error response
      expect(capturedStdout.length).toBeGreaterThan(0);
      const errorResponseJson = capturedStdout[0];
      expect(errorResponseJson).toBeDefined();
      const errorResponse = JSON.parse(errorResponseJson as string);

      expect(errorResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'tools-before-init',
        error: {
          code: -32002,
          message: expect.stringContaining('not initialized'),
        },
      });
    });

    it('should handle invalid JSON through real transport', async () => {
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Send invalid JSON
      const invalidJson = '{"jsonrpc":"2.0","id":1,"method":"test"'; // Missing closing brace

      mockStdin.push(`${invalidJson}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify parse error response
      expect(capturedStdout.length).toBeGreaterThan(0);
      const parseErrorResponseJson = capturedStdout[0];
      expect(parseErrorResponseJson).toBeDefined();
      const errorResponse = JSON.parse(parseErrorResponseJson as string);

      expect(errorResponse).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests through real transport', async () => {
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

      // Send multiple concurrent requests
      const requests = [
        { jsonrpc: '2.0', id: 'req-1', method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 'req-2', method: 'ping', params: {} },
        { jsonrpc: '2.0', id: 'req-3', method: 'tools/list', params: {} },
      ];

      // Send all requests rapidly
      for (const request of requests) {
        mockStdin.push(`${JSON.stringify(request)}\n`);
      }
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have received responses for all requests
      expect(capturedStdout.length).toBe(3);

      // Parse and verify responses
      const responses = capturedStdout.map((output) => JSON.parse(output));

      // Check that all request IDs are present in responses
      const responseIds = responses.map((r) => r.id).sort();
      expect(responseIds).toEqual(['req-1', 'req-2', 'req-3']);

      // Verify response types
      const toolsResponses = responses.filter((r) => r.id === 'req-1' || r.id === 'req-3');
      const pingResponse = responses.find((r) => r.id === 'req-2');

      for (const toolsResponse of toolsResponses) {
        expect(toolsResponse.result).toEqual({ tools: [] });
      }

      expect(pingResponse?.result).toEqual({});
    });

    it('should handle mixed valid and invalid requests', async () => {
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

      // Send mix of valid and invalid requests
      const validRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'valid-1',
        method: 'ping',
        params: {},
      });

      const invalidJson = '{"jsonrpc":"2.0","id":"invalid-1"'; // Missing closing brace

      const unknownMethod = JSON.stringify({
        jsonrpc: '2.0',
        id: 'unknown-1',
        method: 'unknown/method',
        params: {},
      });

      mockStdin.push(`${validRequest}\n`);
      mockStdin.push(`${invalidJson}\n`);
      mockStdin.push(`${unknownMethod}\n`);
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have 3 responses
      expect(capturedStdout.length).toBe(3);

      const responses = capturedStdout.map((output) => JSON.parse(output));

      // Valid request should succeed
      const validResponse = responses.find((r) => r.id === 'valid-1');
      expect(validResponse?.result).toEqual({});

      // Invalid JSON should return parse error
      const parseErrorResponse = responses.find((r) => r.id === null);
      expect(parseErrorResponse?.error?.code).toBe(-32700);

      // Unknown method should return method not found
      const unknownResponse = responses.find((r) => r.id === 'unknown-1');
      expect(unknownResponse?.error?.code).toBe(-32601);
    });
  });

  describe('Transport Registry Integration', () => {
    it('should start and stop multiple transports', async () => {
      // Add a second mock transport
      const mockTransport = {
        name: 'mock-transport',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      transportRegistry.registerTransport(mockTransport);

      // Start all transports
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'));

      // Verify both transports were started
      expect(mockTransport.start).toHaveBeenCalledWith(expect.any(Function));

      // Stop all transports
      await stopAllTransports(transportRegistry);

      // Verify both transports were stopped
      expect(mockTransport.stop).toHaveBeenCalled();
    });

    it('should handle transport startup failures gracefully', async () => {
      // Add a failing transport
      const failingTransport = {
        name: 'failing-transport',
        start: jest.fn().mockRejectedValue(new Error('Transport startup failed')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      transportRegistry.registerTransport(failingTransport);

      // Starting should throw with details about failures
      await expect(startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio'))).rejects.toThrow(
        'Failed to start 1 of 2 transports'
      );
    });

    it('should handle transport with different dispatch functions', async () => {
      // Create a second transport with different dispatch
      const secondTransport = new StdioTransport();
      const secondRegistry = new TransportRegistry();
      secondRegistry.registerTransport(secondTransport);

      // Create different dispatcher for second transport
      const secondDispatcher = new MiddlewareDispatcher({
        requestGate,
        middlewareRegistry,
        middlewareEngine,
        coreDispatcher: async (ctx: any) => {
          ctx.response = {
            jsonrpc: '2.0',
            id: ctx.request.id,
            result: { message: 'Second transport response' },
          };
        },
      });

      // Both should be able to start with different dispatchers
      await startAllTransports(transportRegistry, dispatcher.createTransportDispatch('stdio-1'));
      await startAllTransports(secondRegistry, secondDispatcher.createTransportDispatch('stdio-2'));

      // Clean up
      await stopAllTransports(transportRegistry);
      await stopAllTransports(secondRegistry);
    });
  });

  describe('Protocol Compliance', () => {
    it('should maintain JSON-RPC 2.0 compliance through real transport', async () => {
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

      // Test various JSON-RPC compliance scenarios
      const testCases = [
        // Valid request with string ID
        { jsonrpc: '2.0', id: 'string-id', method: 'ping', params: {} },
        // Valid request with number ID
        { jsonrpc: '2.0', id: 42, method: 'ping', params: {} },
        // Valid request with null ID
        { jsonrpc: '2.0', id: null, method: 'ping', params: {} },
        // Notification (no ID)
        { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
      ];

      for (const testCase of testCases) {
        mockStdin.push(`${JSON.stringify(testCase)}\n`);
      }
      mockStdin.push(null);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have 3 responses (notifications don't get responses)
      expect(capturedStdout.length).toBe(3);

      const responses = capturedStdout.map((output) => JSON.parse(output));

      // All responses should be valid JSON-RPC 2.0
      for (const response of responses) {
        expect(response.jsonrpc).toBe('2.0');
        expect(response).toHaveProperty('id');
        expect(response).toHaveProperty('result');
      }

      // Check ID preservation
      const stringIdResponse = responses.find((r) => r.id === 'string-id');
      const numberIdResponse = responses.find((r) => r.id === 42);
      const nullIdResponse = responses.find((r) => r.id === null);

      expect(stringIdResponse).toBeDefined();
      expect(numberIdResponse).toBeDefined();
      expect(nullIdResponse).toBeDefined();
    });
  });
});
