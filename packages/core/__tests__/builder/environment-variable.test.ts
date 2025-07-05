import { createMcpKitServer } from '../../src/builder';

const mockStdioTransport = {
  name: 'stdio',
  start: jest.fn(async () => {
    // Mock start implementation
  }),
  stop: jest.fn(async () => {
    // Mock stop implementation
  }),
};

jest.mock(
  '@hexmcp/transport-stdio',
  () => ({
    StdioTransport: jest.fn(() => mockStdioTransport),
  }),
  { virtual: true }
);

describe('Environment Variable Behavior', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = originalEnv;
    } else {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    }
  });

  describe('MCPKIT_NO_DEFAULT_TRANSPORT environment variable', () => {
    it('should disable default transport when set to "true"', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should enable default transport when set to "false"', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'false';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should enable default transport when set to empty string', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = '';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should enable default transport when set to "1"', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = '1';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should enable default transport when set to "yes"', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'yes';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should enable default transport when not set', async () => {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should enable default transport when set to undefined', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = undefined as any;

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('environment variable precedence', () => {
    it('should respect environment variable over default behavior', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should allow noDefaultTransport() to override environment variable', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'false';

      const builder = createMcpKitServer();
      builder.noDefaultTransport(); // This should still disable it
      await builder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should allow explicit transport to override environment variable', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'false';

      const mockTransport = {
        name: 'custom',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const builder = createMcpKitServer();
      builder.transport(mockTransport);
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });
  });

  describe('environment variable edge cases', () => {
    it('should handle case sensitivity correctly', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'TRUE';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should handle whitespace in environment variable', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = ' true ';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should work with multiple builder instances', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';

      const builder1 = createMcpKitServer();
      const builder2 = createMcpKitServer();

      await builder1.listen();
      await builder2.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should pick up environment variable changes between builder creations', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
      const builder1 = createMcpKitServer();

      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'false';
      const builder2 = createMcpKitServer();

      await builder1.listen();
      expect(mockStdioTransport.start).not.toHaveBeenCalled();

      jest.clearAllMocks();

      await builder2.listen();
      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployment scenarios', () => {
    it('should work in CI/CD environment with disabled default transport', async () => {
      // Simulate CI environment
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
      process.env.CI = 'true';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();

      delete process.env.CI;
    });

    it('should work in production environment with custom transport', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';
      process.env.NODE_ENV = 'production';

      const mockProductionTransport = {
        name: 'production-transport',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const builder = createMcpKitServer();
      builder.transport(mockProductionTransport);
      await builder.listen();

      expect(mockProductionTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).not.toHaveBeenCalled();

      delete process.env.NODE_ENV;
    });

    it('should work in development environment with default transport', async () => {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
      process.env.NODE_ENV = 'development';

      const builder = createMcpKitServer();
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);

      delete process.env.NODE_ENV;
    });
  });
});
