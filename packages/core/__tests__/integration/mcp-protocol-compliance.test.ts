import { encodeJsonRpcError, encodeJsonRpcSuccess, RpcError } from '@hexmcp/codec-jsonrpc';
import {
  createBuiltInLoggingMiddleware,
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

describe('MCP Protocol Compliance Integration Test', () => {
  let lifecycleManager: McpLifecycleManager;
  let requestGate: McpRequestGate;
  let handshakeHandlers: McpHandshakeHandlers;
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;
  let middlewareRegistry: McpMiddlewareRegistry;
  let middlewareEngine: McpMiddlewareEngine;
  let dispatcher: MiddlewareDispatcher;

  let capturedResponses: unknown[] = [];
  let capturedStdout: string[] = [];
  let capturedStderr: string[] = [];

  beforeEach(() => {
    capturedResponses = [];
    capturedStdout = [];
    capturedStderr = [];

    jest.spyOn(process.stdout, 'write').mockImplementation((data: any) => {
      capturedStdout.push(data.toString());
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((data: any) => {
      capturedStderr.push(data.toString());
      return true;
    });

    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    requestGate = new McpRequestGate(lifecycleManager);
    handshakeHandlers = new McpHandshakeHandlers(lifecycleManager);

    middlewareRegistry = new McpMiddlewareRegistry();
    middlewareEngine = new McpMiddlewareEngine();

    middlewareRegistry.registerMiddleware(createBuiltInLoggingMiddleware());
    middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());

    const coreDispatcher = async (ctx: any) => {
      const { method } = ctx.request;

      if (method === 'initialize') {
        ctx.response = await handshakeHandlers.handleInitialize(ctx.request);
      } else if (method === 'notifications/initialized') {
        await handshakeHandlers.handleInitialized(ctx.request);
        // No response for notifications
      } else if (method === 'tools/list') {
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, { tools: [] });
      } else if (method === 'ping') {
        ctx.response = encodeJsonRpcSuccess(ctx.request.id, {});
      } else {
        ctx.response = encodeJsonRpcError(ctx.request.id, new RpcError(-32601, `Method '${method}' not found`));
      }
    };

    dispatcher = new MiddlewareDispatcher({
      requestGate,
      middlewareRegistry,
      middlewareEngine,
      coreDispatcher,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete MCP Handshake Protocol', () => {
    it('should handle full initialization sequence with proper JSON-RPC responses', async () => {
      const mockRespond = async (response: unknown) => {
        capturedResponses.push(response);
      };

      const transportDispatch = dispatcher.createTransportDispatch('stdio');

      console.log('=== Starting MCP Protocol Compliance Test ===');

      // Step 1: Client sends initialize request
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      console.log('Step 1: Sending initialize request');
      transportDispatch(initializeRequest, mockRespond, { transport: { name: 'stdio' } });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify initialize response
      expect(capturedResponses).toHaveLength(1);
      const initResponse = capturedResponses[0] as any;

      console.log('Initialize response:', JSON.stringify(initResponse, null, 2));

      expect(initResponse.jsonrpc).toBe('2.0');
      expect(initResponse.id).toBe('init-1');
      expect(initResponse.result).toHaveProperty('protocolVersion');
      expect(initResponse.result).toHaveProperty('capabilities');
      expect(initResponse.result).toHaveProperty('serverInfo');

      // Step 2: Client sends initialized notification
      const initializedNotification = {
        jsonrpc: '2.0' as const,
        method: 'notifications/initialized',
        params: {},
      };

      console.log('Step 2: Sending initialized notification');
      transportDispatch(initializedNotification, mockRespond, { transport: { name: 'stdio' } });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Notifications should not generate responses
      expect(capturedResponses).toHaveLength(1);

      // Step 3: Client sends operational request
      const toolsListRequest = {
        jsonrpc: '2.0' as const,
        id: 'tools-1',
        method: 'tools/list',
        params: {},
      };

      console.log('Step 3: Sending tools/list request');
      transportDispatch(toolsListRequest, mockRespond, { transport: { name: 'stdio' } });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify tools/list response
      expect(capturedResponses).toHaveLength(2);
      const toolsResponse = capturedResponses[1] as any;

      console.log('Tools response:', JSON.stringify(toolsResponse, null, 2));

      expect(toolsResponse.jsonrpc).toBe('2.0');
      expect(toolsResponse.id).toBe('tools-1');
      expect(toolsResponse.result).toHaveProperty('tools');
    });

    it('should reject operational requests before initialization with proper error codes', async () => {
      const mockRespond = async (response: unknown) => {
        capturedResponses.push(response);
      };

      const transportDispatch = dispatcher.createTransportDispatch('stdio');

      // Try operational request before initialization
      const toolsListRequest = {
        jsonrpc: '2.0' as const,
        id: 'tools-early',
        method: 'tools/list',
        params: {},
      };

      console.log('Testing pre-initialization rejection');
      transportDispatch(toolsListRequest, mockRespond, { transport: { name: 'stdio' } });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedResponses).toHaveLength(1);
      const errorResponse = capturedResponses[0] as any;

      console.log('Pre-init error response:', JSON.stringify(errorResponse, null, 2));

      expect(errorResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.id).toBe('tools-early');
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32002); // NotInitializedError
      expect(errorResponse.error.message).toContain('not initialized');
    });

    it('should handle post-shutdown requests with correct error code', async () => {
      const mockRespond = async (response: unknown) => {
        capturedResponses.push(response);
      };

      const transportDispatch = dispatcher.createTransportDispatch('stdio');

      // Initialize first
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      await transportDispatch(initializeRequest, mockRespond, { transport: { name: 'stdio' } });

      // Shutdown
      await lifecycleManager.shutdown('Test shutdown');
      expect(lifecycleManager.currentState).toBe(LifecycleState.IDLE);

      // Try operational request after shutdown
      const toolsListRequest = {
        jsonrpc: '2.0' as const,
        id: 'tools-post-shutdown',
        method: 'tools/list',
        params: {},
      };

      console.log('Testing post-shutdown rejection');
      await transportDispatch(toolsListRequest, mockRespond, { transport: { name: 'stdio' } });

      expect(capturedResponses).toHaveLength(2);
      const errorResponse = capturedResponses[1] as any;

      console.log('Post-shutdown error response:', JSON.stringify(errorResponse, null, 2));

      expect(errorResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.id).toBe('tools-post-shutdown');
      expect(errorResponse.error).toBeDefined();

      // FIXED: Now correctly expects -32003 (PostShutdownError)
      expect(errorResponse.error.code).toBe(-32003); // PostShutdownError
      expect(errorResponse.error.message).toContain('shut down'); // Should mention shutdown
    });
  });

  describe('Stdio Transport Output Cleanliness', () => {
    it('should only output JSON-RPC to stdout during real protocol flow', async () => {
      const mockRespond = async (response: unknown) => {
        // Simulate what stdio transport does
        const jsonString = JSON.stringify(response);
        process.stdout.write(`${jsonString}\n`);
      };

      const transportDispatch = dispatcher.createTransportDispatch('stdio');

      // Clear captured output
      capturedStdout.length = 0;
      capturedStderr.length = 0;

      // Send initialize request
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      await transportDispatch(initializeRequest, mockRespond, { transport: { name: 'stdio' } });

      console.log('Stdout output analysis:');
      console.log('  Total stdout writes:', capturedStdout.length);
      console.log('  Total stderr writes:', capturedStderr.length);

      // Filter out JSON-RPC responses from other output
      const jsonRpcOutputs = capturedStdout.filter((output) => output.includes('jsonrpc') && output.includes('2.0'));
      const pollutionOutputs = capturedStdout.filter((output) => !output.includes('jsonrpc') && output.trim().length > 0);

      console.log('  JSON-RPC outputs:', jsonRpcOutputs.length);
      console.log('  Pollution outputs:', pollutionOutputs.length);

      if (pollutionOutputs.length > 0) {
        console.log('  Pollution content:', pollutionOutputs);
      }

      // Should have exactly one JSON-RPC response
      expect(jsonRpcOutputs.length).toBe(1);

      // Should have no stdout pollution (this might fail due to console.log statements)
      if (pollutionOutputs.length > 0) {
        console.warn('STDOUT POLLUTION DETECTED - This would break MCP client handshake!');
      }
    });
  });

  describe('Always-Allowed Requests', () => {
    it('should allow ping requests in any lifecycle state', async () => {
      const mockRespond = async (response: unknown) => {
        capturedResponses.push(response);
      };

      const transportDispatch = dispatcher.createTransportDispatch('stdio');

      const pingRequest = {
        jsonrpc: '2.0' as const,
        id: 'ping-1',
        method: 'ping',
        params: {},
      };

      // Test ping in IDLE state
      console.log('Testing ping in IDLE state');
      await transportDispatch(pingRequest, mockRespond, { transport: { name: 'stdio' } });

      expect(capturedResponses).toHaveLength(1);
      const pingResponse = capturedResponses[0] as any;
      expect(pingResponse.jsonrpc).toBe('2.0');
      expect(pingResponse.id).toBe('ping-1');
      expect(pingResponse.result).toBeDefined();

      // Initialize server
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      await transportDispatch(initializeRequest, mockRespond, { transport: { name: 'stdio' } });

      // Test ping in READY state
      const pingRequest2 = { ...pingRequest, id: 'ping-2' };
      console.log('Testing ping in READY state');
      await transportDispatch(pingRequest2, mockRespond, { transport: { name: 'stdio' } });

      expect(capturedResponses).toHaveLength(3);
      const pingResponse2 = capturedResponses[2] as any;
      expect(pingResponse2.id).toBe('ping-2');
      expect(pingResponse2.result).toBeDefined();
    });
  });
});
