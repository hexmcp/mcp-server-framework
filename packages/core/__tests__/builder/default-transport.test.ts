import { createMcpKitServer } from '../../src/builder';
import type { McpServerBuilder } from '../../src/builder/types';

// Mock the @hexmcp/transport-stdio module
const mockStdioTransport = {
  name: 'stdio',
  start: jest.fn(async () => {
    // Mock start implementation
  }),
  stop: jest.fn(async () => {
    // Mock stop implementation
  }),
};

// Mock the dynamic import
jest.mock(
  '@hexmcp/transport-stdio',
  () => ({
    StdioTransport: jest.fn(() => mockStdioTransport),
  }),
  { virtual: true }
);

describe('Default Transport Behavior', () => {
  let builder: McpServerBuilder;
  let originalEnv: string | undefined;

  beforeEach(() => {
    builder = createMcpKitServer();
    originalEnv = process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = originalEnv;
    } else {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;
    }
  });

  describe('automatic StdioTransport behavior', () => {
    it('should auto-add StdioTransport when no explicit transports are registered', async () => {
      await builder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not add default transport when explicit transport is provided', async () => {
      const mockTransport = {
        name: 'custom',
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
      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should not add default transport when noDefaultTransport() is called', async () => {
      builder.noDefaultTransport();
      await builder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should not add default transport when MCPKIT_NO_DEFAULT_TRANSPORT=true', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'true';

      // Create a new builder to pick up the environment variable
      const envBuilder = createMcpKitServer();
      await envBuilder.listen();

      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should add default transport when MCPKIT_NO_DEFAULT_TRANSPORT=false', async () => {
      process.env.MCPKIT_NO_DEFAULT_TRANSPORT = 'false';

      // Create a new builder to pick up the environment variable
      const envBuilder = createMcpKitServer();
      await envBuilder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });

    it('should add default transport when MCPKIT_NO_DEFAULT_TRANSPORT is not set', async () => {
      delete process.env.MCPKIT_NO_DEFAULT_TRANSPORT;

      // Create a new builder to pick up the environment variable
      const envBuilder = createMcpKitServer();
      await envBuilder.listen();

      expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('noDefaultTransport() method', () => {
    it('should return the builder instance for chaining', () => {
      const result = builder.noDefaultTransport();
      expect(result).toBe(builder);
    });

    it('should disable default transport even when called after other configurations', () => {
      builder
        .tool('test', {
          description: 'Test tool',
          handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        })
        .noDefaultTransport();

      return expect(builder.listen()).resolves.toBeUndefined();
    });

    it('should work with explicit transport after noDefaultTransport()', async () => {
      const mockTransport = {
        name: 'custom',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.noDefaultTransport().transport(mockTransport);
      await builder.listen();

      expect(mockTransport.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });
  });

  describe('transport() method behavior', () => {
    it('should disable default transport when explicit transport is added', async () => {
      const mockTransport = {
        name: 'custom',
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
      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });

    it('should work with multiple explicit transports', async () => {
      const mockTransport1 = {
        name: 'custom1',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      const mockTransport2 = {
        name: 'custom2',
        start: jest.fn(async () => {
          // Mock start implementation
        }),
        stop: jest.fn(async () => {
          // Mock stop implementation
        }),
      };

      builder.transport(mockTransport1).transport(mockTransport2);
      await builder.listen();

      expect(mockTransport1.start).toHaveBeenCalledTimes(1);
      expect(mockTransport2.start).toHaveBeenCalledTimes(1);
      expect(mockStdioTransport.start).not.toHaveBeenCalled();
    });
  });
});
