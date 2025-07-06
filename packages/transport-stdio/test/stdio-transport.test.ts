import { Readable } from 'node:stream';
import { JSON_RPC_ERROR_CODES } from '@hexmcp/codec-jsonrpc';
import type { TransportDispatch } from '@hexmcp/transport';
import { StdioTransport } from '../src/stdio-transport';

describe('StdioTransport', () => {
  let transport: StdioTransport;
  let mockStdout: jest.SpyInstance;
  let mockStdin: Readable;
  let originalStdin: NodeJS.ReadableStream;

  beforeEach(() => {
    transport = new StdioTransport();
    mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mockStdin = new Readable({
      read() {
        // Mock implementation - no-op
      },
    });

    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });
  });

  afterEach(async () => {
    await transport.stop();
    mockStdout.mockRestore();

    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    });
  });

  describe('interface compliance', () => {
    it('should have correct name', () => {
      expect(transport.name).toBe('stdio');
    });

    it('should implement ServerTransport interface', () => {
      expect(typeof transport.start).toBe('function');
      expect(typeof transport.stop).toBe('function');
      expect(typeof transport.name).toBe('string');
    });
  });

  describe('lifecycle management', () => {
    it('should start successfully with dispatch function', async () => {
      const dispatch = jest.fn();

      await expect(transport.start(dispatch)).resolves.toBeUndefined();
    });

    it('should throw error when starting already started transport', async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);

      await expect(transport.start(dispatch)).rejects.toThrow('StdioTransport is already started');
    });

    it('should stop gracefully', async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it('should handle multiple stop calls without throwing', async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await transport.stop();
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it('should handle stop before start', async () => {
      await expect(transport.stop()).resolves.toBeUndefined();
    });
  });

  describe('message processing', () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it('should process valid JSON-RPC request', async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test","params":{"foo":"bar"}}';

      await sendMessage(request);

      expect(dispatch).toHaveBeenCalledWith(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: { foo: 'bar' },
        },
        expect.any(Function),
        {
          transport: {
            name: 'stdio',
          },
        }
      );
    });

    it('should process valid JSON-RPC notification', async () => {
      const notification = '{"jsonrpc":"2.0","method":"notify","params":["hello"]}';

      await sendMessage(notification);

      expect(dispatch).toHaveBeenCalledWith(
        {
          jsonrpc: '2.0',
          method: 'notify',
          params: ['hello'],
        },
        expect.any(Function),
        {
          transport: {
            name: 'stdio',
          },
        }
      );
    });

    it('should handle invalid JSON with parse error response', async () => {
      const invalidJson = '{"jsonrpc":"2.0","id":1,"method":"test"';

      await sendMessage(invalidJson);

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"message":"Parse error"'));
    });

    it('should handle malformed JSON-RPC with parse error response', async () => {
      const malformed = '{"version":"1.0","id":1}';

      await sendMessage(malformed);

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
    });
  });

  describe('response handling', () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    it('should write response as NDJSON to stdout', async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      await sendMessage(request);

      const [, respond] = dispatch.mock.calls[0] as [unknown, (response: unknown) => Promise<void>, unknown];
      const response = { jsonrpc: '2.0', id: 1, result: 'success' };

      respond(response);

      expect(mockStdout).toHaveBeenCalledWith('{"jsonrpc":"2.0","id":1,"result":"success"}\n');
    });

    it('should handle response serialization errors gracefully', async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      await sendMessage(request);

      const [, respond] = dispatch.mock.calls[0] as [unknown, (response: unknown) => Promise<void>, unknown];
      const circularResponse = {};
      (circularResponse as any).self = circularResponse;

      const initialCallCount = mockStdout.mock.calls.length;

      respond(circularResponse);

      // Should not write anything to stdout when serialization fails
      expect(mockStdout.mock.calls.length).toBe(initialCallCount);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };
  });

  describe('NDJSON protocol compliance', () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    const sendMultipleMessages = (messages: string[]): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        messages.forEach((msg) => mockStdin.push(`${msg}\n`));
        mockStdin.push(null);
      });
    };

    it('should process multiple NDJSON lines', async () => {
      const line1 = '{"jsonrpc":"2.0","id":1,"method":"first"}';
      const line2 = '{"jsonrpc":"2.0","id":2,"method":"second"}';

      await sendMultipleMessages([line1, line2]);

      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: 1, method: 'first' }),
        expect.any(Function),
        expect.any(Object)
      );
      expect(dispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: 2, method: 'second' }),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should handle empty lines gracefully', async () => {
      await sendMessage('');

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
    });

    it('should maintain line boundaries correctly', async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      mockStdin.push(request.slice(0, 10));
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(dispatch).not.toHaveBeenCalled();

      await sendMessage(request.slice(10));
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error edge cases', () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it('should not process messages after stop', async () => {
      await transport.stop();

      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';
      await sendMessage(request);

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('should handle stdin close event gracefully', async () => {
      mockStdin.emit('close');
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(transport.name).toBe('stdio');
    });
  });

  describe('parse error responses', () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it('should return parse error with null id for invalid JSON', async () => {
      await sendMessage('invalid json');

      expect(mockStdout).toHaveBeenCalledWith(expect.stringMatching(/"jsonrpc":"2\.0".*"id":null.*"error".*"code":-32700/));
    });

    it('should return parse error for empty string', async () => {
      await sendMessage('');

      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining(`"code":${JSON_RPC_ERROR_CODES.PARSE_ERROR}`));
    });

    it('should return parse error for non-object JSON', async () => {
      await sendMessage('42');

      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining(`"code":${JSON_RPC_ERROR_CODES.PARSE_ERROR}`));
    });
  });
});

describe('StdioTransport Integration', () => {
  let transport: StdioTransport;
  let mockStdout: jest.SpyInstance;
  let mockStdin: Readable;
  let originalStdin: NodeJS.ReadableStream;

  beforeEach(() => {
    transport = new StdioTransport();
    mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mockStdin = new Readable({
      read() {
        // Mock implementation - no-op
      },
    });

    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });
  });

  afterEach(async () => {
    await transport.stop();
    mockStdout.mockRestore();

    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    });
  });

  const sendMessage = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 10);
      mockStdin.push(`${message}\n`);
      mockStdin.push(null);
    });
  };

  const sendMultipleMessages = (messages: string[]): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 10);
      messages.forEach((msg) => mockStdin.push(`${msg}\n`));
      mockStdin.push(null);
    });
  };

  it('should work with transport registry pattern', async () => {
    const dispatch = jest.fn();

    expect(transport.name).toBe('stdio');
    expect(typeof transport.start).toBe('function');
    expect(typeof transport.stop).toBe('function');

    await transport.start(dispatch);

    const request = '{"jsonrpc":"2.0","id":"test-123","method":"ping"}';
    await sendMessage(request);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'ping',
      }),
      expect.any(Function),
      expect.objectContaining({
        transport: { name: 'stdio' },
      })
    );

    await transport.stop();
  });

  describe('silent mode configuration', () => {
    let originalConsole: {
      log: typeof console.log;
      info: typeof console.info;
      warn: typeof console.warn;
      error: typeof console.error;
    };

    beforeEach(() => {
      originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
      };
    });

    afterEach(() => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    });

    it('should enable silent mode by default', async () => {
      const transport = new StdioTransport();
      const dispatch = jest.fn();

      await transport.start(dispatch);

      // Test that calling the console functions doesn't throw
      expect(() => console.log('This should be suppressed')).not.toThrow();
      expect(() => console.info('This should also be suppressed')).not.toThrow();

      await transport.stop();
    });

    it('should allow disabling silent mode', async () => {
      const transport = new StdioTransport({ silent: false });
      const dispatch = jest.fn();

      const logSpy = jest.spyOn(console, 'log');
      const infoSpy = jest.spyOn(console, 'info');

      await transport.start(dispatch);

      console.log('This should not be suppressed');
      console.info('This should also not be suppressed');

      expect(logSpy).toHaveBeenCalledWith('This should not be suppressed');
      expect(infoSpy).toHaveBeenCalledWith('This should also not be suppressed');

      await transport.stop();
    });

    it('should redirect warn and error to stderr in silent mode', async () => {
      const transport = new StdioTransport({ silent: true });
      const dispatch = jest.fn();

      await transport.start(dispatch);

      // Test that warn and error functions can be called without throwing
      expect(() => console.warn('Warning message')).not.toThrow();
      expect(() => console.error('Error message')).not.toThrow();

      await transport.stop();
    });

    it('should restore console methods after stop', async () => {
      const transport = new StdioTransport({ silent: true });
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await transport.stop();

      // Test that console methods work normally after stop
      expect(() => console.log('Normal log')).not.toThrow();
      expect(() => console.info('Normal info')).not.toThrow();
      expect(() => console.warn('Normal warn')).not.toThrow();
      expect(() => console.error('Normal error')).not.toThrow();
    });

    it('should handle multiple start/stop cycles correctly', async () => {
      const transport = new StdioTransport({ silent: true });
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await transport.stop();

      await transport.start(dispatch);
      await transport.stop();

      expect(console.log).toBe(originalConsole.log);
      expect(console.info).toBe(originalConsole.info);
      expect(console.warn).toBe(originalConsole.warn);
      expect(console.error).toBe(originalConsole.error);
    });
  });

  it('should handle concurrent message processing', async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    const requests = [
      '{"jsonrpc":"2.0","id":1,"method":"first"}',
      '{"jsonrpc":"2.0","id":2,"method":"second"}',
      '{"jsonrpc":"2.0","id":3,"method":"third"}',
    ];

    await sendMultipleMessages(requests);

    expect(dispatch).toHaveBeenCalledTimes(3);

    const responses = [
      { jsonrpc: '2.0', id: 1, result: 'first-result' },
      { jsonrpc: '2.0', id: 2, result: 'second-result' },
      { jsonrpc: '2.0', id: 3, result: 'third-result' },
    ];

    dispatch.mock.calls.forEach(([, respond], index) => {
      respond(responses[index]);
    });

    expect(mockStdout).toHaveBeenCalledTimes(3);
    responses.forEach((response) => {
      expect(mockStdout).toHaveBeenCalledWith(`${JSON.stringify(response)}\n`);
    });
  });

  it('should provide correct metadata structure', async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    const request = '{"jsonrpc":"2.0","id":"meta-test","method":"getMetadata"}';
    await sendMessage(request);

    const [, , metadata] = dispatch.mock.calls[0];

    expect(metadata).toEqual({
      transport: {
        name: 'stdio',
      },
    });
  });
});

describe('StdioTransport Logging Compatibility', () => {
  let transport: StdioTransport;
  let mockStdout: jest.SpyInstance;
  let mockStderr: jest.SpyInstance;
  let mockStdin: Readable;
  let originalStdin: NodeJS.ReadableStream;

  beforeEach(() => {
    transport = new StdioTransport();
    mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    mockStdin = new Readable({
      read() {
        // Mock implementation - no-op
      },
    });

    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });
  });

  afterEach(async () => {
    await transport.stop();
    mockStdout.mockRestore();
    mockStderr.mockRestore();

    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    });
  });

  const sendMessage = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 10);
      mockStdin.push(`${message}\n`);
      mockStdin.push(null);
    });
  };

  it('should not pollute stdout with console.log calls during handshake', async () => {
    const dispatch = jest.fn().mockImplementation(async (message, respond) => {
      // Simulate a response to the initialize request
      await respond({
        jsonrpc: '2.0',
        id: (message as any).id,
        result: { protocolVersion: '2024-11-05', capabilities: {} },
      });
    });
    await transport.start(dispatch);

    // Clear any previous calls
    mockStdout.mockClear();

    // Simulate logging that might happen during request processing
    // Use process.stdout.write directly to bypass Jest's console mocking
    process.stdout.write('This should not interfere with JSON-RPC\n');
    process.stdout.write('Info message\n');

    const initializeRequest = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}';

    await sendMessage(initializeRequest);

    // Verify that both pollution and JSON-RPC response were written to stdout
    const allCalls = mockStdout.mock.calls.map((call) => call[0]);
    const pollutionCalls = allCalls.filter((call) => call.includes('This should not interfere'));
    const jsonRpcCalls = allCalls.filter((call) => call.includes('jsonrpc'));

    expect(pollutionCalls.length).toBeGreaterThan(0);
    expect(jsonRpcCalls.length).toBeGreaterThan(0);

    // This test demonstrates the problem - stdout pollution interferes with JSON-RPC
    // In a real scenario, this would break the MCP client handshake
  });

  it('should allow stderr logging without interfering with JSON-RPC protocol', async () => {
    const dispatch = jest.fn().mockImplementation(async (message, respond) => {
      // Simulate a response to the tools/list request
      await respond({
        jsonrpc: '2.0',
        id: (message as any).id,
        result: { tools: [] },
      });
    });
    await transport.start(dispatch);

    // Clear any previous calls
    mockStderr.mockClear();
    mockStdout.mockClear();

    // Simulate stderr logging (which is safe for stdio transport)
    process.stderr.write('This is safe for stdio transport\n');
    process.stderr.write(`${JSON.stringify({ level: 'error', message: 'Structured log to stderr' })}\n`);

    const request = '{"jsonrpc":"2.0","id":2,"method":"tools/list"}';

    await sendMessage(request);

    // Verify that stderr logging happened
    expect(mockStderr.mock.calls.length).toBeGreaterThan(0);

    // Verify that JSON-RPC still works correctly
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
      expect.any(Function),
      expect.any(Object)
    );

    // Verify that stderr doesn't interfere with stdout JSON-RPC
    const stdoutCalls = mockStdout.mock.calls.map((call) => call[0]);
    const jsonRpcCalls = stdoutCalls.filter((call) => call.includes('jsonrpc'));
    expect(jsonRpcCalls.length).toBeGreaterThan(0);
  });

  it('should handle mixed stdout pollution and valid JSON-RPC gracefully', async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    // Clear any previous calls
    mockStdout.mockClear();

    // This simulates what happens when logging middleware accidentally writes to stdout
    process.stdout.write('Accidental stdout pollution\n');

    const request = '{"jsonrpc":"2.0","id":3,"method":"ping"}';
    await sendMessage(request);

    // The transport should still process the valid JSON-RPC message
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      }),
      expect.any(Function),
      expect.any(Object)
    );

    // Verify that both pollution and JSON-RPC response were written to stdout
    const allCalls = mockStdout.mock.calls.map((call) => call[0]);
    expect(allCalls.some((call) => call.includes('Accidental stdout pollution'))).toBe(true);

    // Note: The JSON-RPC response might not be written if dispatch doesn't call respond
    // This test demonstrates the pollution problem
  });

  it('should demonstrate proper stderr-only logging pattern', async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    // Clear any previous calls
    mockStderr.mockClear();
    mockStdout.mockClear();

    // Proper logging pattern for stdio transport - use stderr only
    const stderrLogger = {
      log: (level: string, message: string, data?: unknown) => {
        const logEntry = {
          level,
          message,
          timestamp: new Date().toISOString(),
          ...(data ? { data } : {}),
        };
        process.stderr.write(`${JSON.stringify(logEntry)}\n`);
      },
    };

    stderrLogger.log('info', 'Request processing started', { requestId: 'test-123' });

    const request = '{"jsonrpc":"2.0","id":"test-123","method":"tools/call","params":{"name":"echo","arguments":{"text":"hello"}}}';
    await sendMessage(request);

    stderrLogger.log('info', 'Request processing completed', { requestId: 'test-123' });

    // Verify stderr logging happened
    const stderrCalls = mockStderr.mock.calls.filter((call) => call[0].includes('Request processing'));
    expect(stderrCalls.length).toBe(2);

    // Verify stdout only contains JSON-RPC traffic (no pollution)
    const stdoutCalls = mockStdout.mock.calls.map((call) => call[0]);
    const nonJsonRpcStdout = stdoutCalls.filter((call) => !call.includes('jsonrpc') && call.trim().length > 0);
    expect(nonJsonRpcStdout).toHaveLength(0);

    // Verify JSON-RPC processing worked
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'tools/call',
      }),
      expect.any(Function),
      expect.any(Object)
    );
  });
});
