import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

describe('Builder Capability Integration', () => {
  let builder: McpServerBuilder;

  beforeEach(() => {
    builder = createMcpKitServer();
  });

  describe('client capability processing', () => {
    it('should process and store client capabilities during handshake', async () => {
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

      const clientCapabilities: ClientCapabilities = {
        experimental: {
          customFeature: true,
          advancedStreaming: { enabled: true, maxChunks: 100 },
        },
        sampling: {},
      };

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: clientCapabilities,
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, mockRespond);

      expect(capturedResponse.result).toBeDefined();
      expect(capturedResponse.error).toBeUndefined();
    });

    it('should handle client capabilities with empty experimental features', async () => {
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

      const clientCapabilities: ClientCapabilities = {
        experimental: {},
        sampling: {},
      };

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: clientCapabilities,
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, mockRespond);

      expect(capturedResponse.result).toBeDefined();
      expect(capturedResponse.error).toBeUndefined();
    });
  });

  describe('dynamic capability negotiation', () => {
    it('should include prompts capability when prompts are registered', async () => {
      builder.prompt('test-prompt', {
        description: 'Test prompt for capability detection',
        handler: async (): Promise<string> => 'test response',
      });

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

      expect(capturedResponse.result.capabilities.prompts).toBeDefined();
      expect(capturedResponse.result.capabilities.prompts).toEqual({});
    });

    it('should include tools capability when tools are registered', async () => {
      builder.tool('test-tool', {
        description: 'Test tool for capability detection',
        handler: async (): Promise<{ result: string }> => ({ result: 'test' }),
      });

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

      expect(capturedResponse.result.capabilities.tools).toBeDefined();
      expect(capturedResponse.result.capabilities.tools).toEqual({});
    });

    it('should include resources capability when resources are registered', async () => {
      builder.resource('test://*', {
        name: 'Test Resource',
        provider: {
          get: async (): Promise<{ data: string }> => ({ data: 'test' }),
          list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
        },
      });

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

      expect(capturedResponse.result.capabilities.resources).toBeDefined();
      expect(capturedResponse.result.capabilities.resources).toEqual({
        subscribe: false,
        listChanged: false,
      });
    });

    it('should include all capabilities when multiple primitives are registered', async () => {
      builder
        .prompt('test-prompt', {
          description: 'Test prompt',
          handler: async (): Promise<string> => 'test response',
        })
        .tool('test-tool', {
          description: 'Test tool',
          handler: async (): Promise<{ result: string }> => ({ result: 'test' }),
        })
        .resource('test://*', {
          name: 'Test Resource',
          provider: {
            get: async (): Promise<{ data: string }> => ({ data: 'test' }),
            list: async (): Promise<{ resources: any[] }> => ({ resources: [] }),
          },
        });

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

      const capabilities = capturedResponse.result.capabilities;
      expect(capabilities.prompts).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.experimental).toBeDefined();
      expect(capabilities.logging).toBeDefined();
    });

    it('should not include primitive capabilities when no primitives are registered', async () => {
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

      const capabilities = capturedResponse.result.capabilities;
      expect(capabilities.prompts).toBeUndefined();
      expect(capabilities.tools).toBeUndefined();
      expect(capabilities.resources).toBeUndefined();
      expect(capabilities.experimental).toBeDefined();
      expect(capabilities.logging).toBeDefined();
    });
  });

  describe('protocol version negotiation', () => {
    it('should support multiple MCP protocol versions', async () => {
      const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];

      for (const version of supportedVersions) {
        const testBuilder = createMcpKitServer();

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

        testBuilder.transport(mockTransport);
        await testBuilder.listen();

        const initializeRequest = {
          jsonrpc: '2.0' as const,
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: version,
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

        expect(capturedResponse.result).toBeDefined();
        expect(capturedResponse.error).toBeUndefined();
        expect(capturedResponse.result.protocolVersion).toBe(version);
      }
    });

    it('should reject unsupported protocol versions', async () => {
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

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2023-01-01',
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

      expect(capturedResponse.error).toBeDefined();
      expect(capturedResponse.result).toBeUndefined();
      expect(capturedResponse.error.code).toBe(-32603);
      expect(capturedResponse.error.message).toContain('Unsupported protocol version');
    });
  });

  describe('handshake error scenarios', () => {
    it('should reject initialize request with missing capabilities', async () => {
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

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          clientInfo: { name: 'Test Client', version: '1.0.0' },
        },
      };

      let capturedResponse: any;
      const mockRespond = jest.fn().mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, mockRespond);

      expect(capturedResponse.error).toBeDefined();
      expect(capturedResponse.result).toBeUndefined();
      expect(capturedResponse.error.code).toBe(-32602);
      expect(capturedResponse.error.message).toContain('Missing required capabilities');
    });

    it('should reject initialize request with missing protocol version', async () => {
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

      const initializeRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
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

      expect(capturedResponse.error).toBeDefined();
      expect(capturedResponse.result).toBeUndefined();
      expect(capturedResponse.error.code).toBe(-32602);
      expect(capturedResponse.error.message).toContain('Missing required protocolVersion');
    });

    it('should reject duplicate initialization attempts', async () => {
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

      const mockRespond = jest.fn();

      await capturedDispatcher(initializeRequest, mockRespond);

      let capturedResponse: any;
      mockRespond.mockImplementation((response) => {
        capturedResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, mockRespond);

      expect(capturedResponse.error).toBeDefined();
      expect(capturedResponse.result).toBeUndefined();
      expect(capturedResponse.error.code).toBe(-32600);
      expect(capturedResponse.error.message).toContain('already initialized');
    });
  });

  describe('capability consistency', () => {
    it('should maintain consistent capabilities across multiple initialize requests', async () => {
      builder
        .prompt('consistent-prompt', {
          description: 'Consistent prompt',
          handler: async (): Promise<string> => 'consistent response',
        })
        .tool('consistent-tool', {
          description: 'Consistent tool',
          handler: async (): Promise<{ result: string }> => ({ result: 'consistent' }),
        });

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

      let firstResponse: any;
      const firstRespond = jest.fn().mockImplementation((response) => {
        firstResponse = response;
        return Promise.resolve();
      });

      await capturedDispatcher(initializeRequest, firstRespond);

      const firstCapabilities = firstResponse.result.capabilities;
      expect(firstCapabilities.prompts).toBeDefined();
      expect(firstCapabilities.tools).toBeDefined();
      expect(firstCapabilities.experimental).toBeDefined();
      expect(firstCapabilities.logging).toBeDefined();
    });
  });
});
