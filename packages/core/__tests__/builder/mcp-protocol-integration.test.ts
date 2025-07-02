import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

describe('Builder MCP Protocol Integration', () => {
  let builder: McpServerBuilder;

  beforeEach(() => {
    builder = createMcpKitServer();
  });

  describe('MCP handshake integration', () => {
    it('should handle initialize request with proper capability negotiation', async () => {
      // Add some prompts and tools to test capability detection
      builder
        .prompt('test-prompt', {
          handler: async (): Promise<string> => 'test response',
        })
        .tool('test-tool', {
          handler: async (): Promise<{ result: string }> => ({ result: 'test' }),
        })
        .resource('test://*', {
          provider: {
            get: async (): Promise<{ content: string }> => ({ content: 'test' }),
            list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
          },
        });

      // Create a mock transport to capture the dispatcher
      let capturedDispatcher: any;
      const mockTransport = {
        name: 'test-transport',
        start: jest.fn().mockImplementation((dispatcher) => {
          capturedDispatcher = dispatcher;
          return Promise.resolve();
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      builder.transport(mockTransport);

      // Start the server to get the dispatcher
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalled();
      expect(capturedDispatcher).toBeDefined();

      // Test initialize request
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, mockRespond);

      expect(mockRespond).toHaveBeenCalledTimes(1);
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.jsonrpc).toBe('2.0');
      expect(capturedResponse.id).toBe(1);
      expect(capturedResponse.result).toBeDefined();
      expect(capturedResponse.error).toBeUndefined();

      // Verify server info
      expect(capturedResponse.result.serverInfo).toBeDefined();
      expect(capturedResponse.result.serverInfo.name).toBe('MCP Server Framework');
      expect(capturedResponse.result.serverInfo.version).toBe('1.0.0');

      // Verify protocol version
      expect(capturedResponse.result.protocolVersion).toBe('2025-06-18');

      // Verify capabilities structure
      expect(capturedResponse.result.capabilities).toBeDefined();
      expect(capturedResponse.result.capabilities.experimental).toBeDefined();
      expect(capturedResponse.result.capabilities.logging).toBeDefined();
      expect(capturedResponse.result.capabilities.prompts).toBeDefined();
      expect(capturedResponse.result.capabilities.tools).toBeDefined();
      expect(capturedResponse.result.capabilities.resources).toBeDefined();
    });

    it('should handle initialized notification', async () => {
      const mockTransport = {
        name: 'test-transport',
        start: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let capturedDispatcher: any;
      mockTransport.start.mockImplementation((dispatcher) => {
        capturedDispatcher = dispatcher;
        return Promise.resolve();
      });

      builder.transport(mockTransport);
      await builder.listen();

      // First initialize
      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      await capturedDispatcher(initializeRequest, jest.fn());

      const initializedNotification = {
        jsonrpc: '2.0' as const,
        method: 'notifications/initialized',
        params: {},
      };

      const mockRespond = jest.fn();

      await expect(capturedDispatcher(initializedNotification, mockRespond)).resolves.toBeUndefined();

      expect(mockRespond).not.toHaveBeenCalled();

      expect(capturedDispatcher).toBeDefined();
    });

    it.each([
      {
        method: 'prompts/get',
        params: { name: 'test-prompt' },
        setup: (builder: any) => builder.prompt('test-prompt', { handler: async (): Promise<string> => 'test response' }),
      },
      {
        method: 'tools/call',
        params: { name: 'test-tool', arguments: {} },
        setup: (builder: any) => builder.tool('test-tool', { handler: async (): Promise<{ result: string }> => ({ result: 'test' }) }),
      },
      {
        method: 'resources/read',
        params: { uri: 'test://resource' },
        setup: (builder: any) =>
          builder.resource('test://resource', {
            provider: {
              get: async (): Promise<{ content: string }> => ({ content: 'test' }),
              list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
            },
          }),
      },
    ])('should reject $method requests before initialization', async ({ method, params, setup }) => {
      const mockTransport = {
        name: 'test-transport',
        start: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let capturedDispatcher: any;
      mockTransport.start.mockImplementation((dispatcher) => {
        capturedDispatcher = dispatcher;
        return Promise.resolve();
      });

      setup(builder).transport(mockTransport);

      await builder.listen();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method,
        params,
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(request, mockRespond);

      expect(mockRespond).toHaveBeenCalledTimes(1);
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.jsonrpc).toBe('2.0');
      expect(capturedResponse.id).toBe(1);
      expect(capturedResponse.result).toBeUndefined();
      expect(capturedResponse.error).toBeDefined();
      expect(capturedResponse.error.code).toBe(-32002);
      expect(capturedResponse.error.message).toContain('not initialized');
      expect(capturedResponse.error.data).toBeUndefined();
    });

    it.each([
      {
        method: 'prompts/get',
        params: { name: 'test-prompt' },
        setup: (builder: any) => builder.prompt('test-prompt', { handler: async (): Promise<string> => 'test response' }),
        validateResponse: (response: any) => {
          expect(response.result.messages).toBeDefined();
          expect(Array.isArray(response.result.messages)).toBe(true);
          expect(response.result.messages).toHaveLength(1);
          expect(response.result.messages[0]).toMatchObject({
            role: 'user',
            content: { type: 'text', text: 'test response' },
          });
        },
      },
      {
        method: 'tools/call',
        params: { name: 'test-tool', arguments: {} },
        setup: (builder: any) =>
          builder.tool('test-tool', { handler: async (): Promise<{ content: string }> => ({ content: 'test result' }) }),
        validateResponse: (response: any) => {
          expect(response.result.content).toBeDefined();
          expect(Array.isArray(response.result.content)).toBe(true);
          expect(response.result.content).toHaveLength(1);
          expect(response.result.content[0]).toMatchObject({
            type: 'text',
            text: JSON.stringify({ content: 'test result' }),
          });
        },
      },
      {
        method: 'resources/read',
        params: { uri: 'test://resource' },
        setup: (builder: any) =>
          builder.resource('test://resource', {
            provider: {
              get: async (): Promise<{ data: string }> => ({ data: 'test' }),
              list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
            },
          }),
        validateResponse: (response: any) => {
          expect(response.result.contents).toBeDefined();
          expect(Array.isArray(response.result.contents)).toBe(true);
          expect(response.result.contents).toHaveLength(1);
          expect(response.result.contents[0]).toMatchObject({
            uri: 'test://resource',
            mimeType: 'application/json',
            text: JSON.stringify({ data: 'test' }),
          });
        },
      },
    ])('should allow $method requests after initialization', async ({ method, params, setup, validateResponse }) => {
      const mockTransport = {
        name: 'test-transport',
        start: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      let capturedDispatcher: any;
      mockTransport.start.mockImplementation((dispatcher) => {
        capturedDispatcher = dispatcher;
        return Promise.resolve();
      });

      setup(builder).transport(mockTransport);

      await builder.listen();

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { experimental: {}, sampling: {} },
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      await capturedDispatcher(initializeRequest, jest.fn());

      const operationalRequest = {
        jsonrpc: '2.0' as const,
        id: 2,
        method,
        params,
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(operationalRequest, mockRespond);

      expect(mockRespond).toHaveBeenCalledTimes(1);
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.jsonrpc).toBe('2.0');
      expect(capturedResponse.id).toBe(2);
      expect(capturedResponse.result).toBeDefined();
      expect(capturedResponse.error).toBeUndefined();

      validateResponse(capturedResponse);
    });
  });
});
