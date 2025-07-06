import { encodeJsonRpcSuccess, JSON_RPC_ERROR_CODES, RpcError } from '@hexmcp/codec-jsonrpc';
import { createBuiltInLoggingMiddleware, createStreamingInfoMiddleware, loggerMiddleware } from '../../src/middleware/logger';
import type { LogEntry, Logger, LogLevel, Middleware, StreamingRequestContext } from '../../src/middleware/types';
import { createMockRequestContext, SAMPLE_JSON_RPC_REQUEST } from '../fixtures/middleware-fixtures';

interface MockLogEntry {
  timestamp: number;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
}

interface MockLogger extends Logger {
  logs: Array<{
    level: LogLevel;
    message: string;
    meta?: MockLogEntry;
  }>;
}

function createMockLogger(): MockLogger {
  const logs: Array<{ level: LogLevel; message: string; meta?: MockLogEntry }> = [];

  return {
    logs,
    error: (message: string, meta?: LogEntry) => {
      const mockMeta = meta as unknown as MockLogEntry;
      logs.push({ level: 'error', message, meta: mockMeta });
    },
    warn: (message: string, meta?: LogEntry) => {
      const mockMeta = meta as unknown as MockLogEntry;
      logs.push({ level: 'warn', message, meta: mockMeta });
    },
    info: (message: string, meta?: LogEntry) => {
      const mockMeta = meta as unknown as MockLogEntry;
      logs.push({ level: 'info', message, meta: mockMeta });
    },
    debug: (message: string, meta?: LogEntry) => {
      const mockMeta = meta as unknown as MockLogEntry;
      logs.push({ level: 'debug', message, meta: mockMeta });
    },
    log: (level: LogLevel, message: string, meta?: LogEntry) => {
      const mockMeta = meta as unknown as MockLogEntry;
      logs.push({ level, message, meta: mockMeta });
    },
  };
}

describe('loggerMiddleware', () => {
  let mockLogger: MockLogger;
  let originalEnv: string | undefined;

  beforeEach(() => {
    mockLogger = createMockLogger();
    originalEnv = process.env.MCPKIT_DEBUG;
    delete process.env.MCPKIT_DEBUG;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCPKIT_DEBUG = originalEnv;
    } else {
      delete process.env.MCPKIT_DEBUG;
    }
  });

  describe('success scenarios', () => {
    it('should log request start and completion with traceId, method, transport, and status', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext({
        request: { ...SAMPLE_JSON_RPC_REQUEST, method: 'tools/execute', id: 'req-123' },
        transport: { name: 'stdio' },
      });

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('req-123', { result: 'success' });
      });

      expect(mockLogger.logs).toHaveLength(1);
      const logEntry = getLogEntry(mockLogger.logs, 0);

      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Request completed');
      expect(logEntry.meta?.metadata).toMatchObject({
        method: 'tools/execute',
        transport: 'stdio',
        status: 'ok',
        traceId: expect.stringMatching(/^req-[a-z0-9]{8}$/),
        durationMs: expect.any(Number),
      });
      expect(logEntry.meta?.metadata?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should generate unique traceId for each request', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx1 = createMockRequestContext();
      const ctx2 = createMockRequestContext();

      await middleware(ctx1, async () => {
        ctx1.response = encodeJsonRpcSuccess('1', {});
      });

      await middleware(ctx2, async () => {
        ctx2.response = encodeJsonRpcSuccess('2', {});
      });

      expect(mockLogger.logs).toHaveLength(2);
      const entry1 = getLogEntry(mockLogger.logs, 0);
      const entry2 = getLogEntry(mockLogger.logs, 1);
      const traceId1 = entry1.meta?.metadata?.traceId;
      const traceId2 = entry2.meta?.metadata?.traceId;

      expect(traceId1).not.toBe(traceId2);
      expect(traceId1).toMatch(/^req-[a-z0-9]{8}$/);
      expect(traceId2).toMatch(/^req-[a-z0-9]{8}$/);
    });

    it('should store traceId in context state for downstream middleware', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();
      let capturedTraceId: string | undefined;

      await middleware(ctx, async () => {
        capturedTraceId = ctx.state.traceId as string;
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(capturedTraceId).toBeDefined();
      expect(capturedTraceId).toMatch(/^req-[a-z0-9]{8}$/);
      const entry = getLogEntry(mockLogger.logs, 0);
      expect(entry.meta?.metadata?.traceId).toBe(capturedTraceId);
    });

    it('should measure and log execution duration accurately', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();
      const delay = 50;

      await middleware(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(mockLogger.logs).toHaveLength(1);
      const entry = getLogEntry(mockLogger.logs, 0);
      const durationMs = entry.meta?.metadata?.durationMs;
      expect(durationMs).toBeGreaterThanOrEqual(delay - 10);
      expect(durationMs).toBeLessThan(delay + 50);
    });
  });

  describe('error scenarios', () => {
    it('should log errors with status=error, error code, and traceId', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext({
        request: { ...SAMPLE_JSON_RPC_REQUEST, method: 'tools/execute', id: 'req-456' },
        transport: { name: 'stdio' },
      });

      const testError = new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, 'Something went wrong');

      await expect(
        middleware(ctx, async () => {
          throw testError;
        })
      ).rejects.toThrow('Something went wrong');

      expect(mockLogger.logs).toHaveLength(1);
      const logEntry = getLogEntry(mockLogger.logs, 0);

      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Request failed');
      expect(logEntry.meta?.metadata).toMatchObject({
        method: 'tools/execute',
        transport: 'stdio',
        status: 'error',
        code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        error: 'Something went wrong',
        traceId: expect.stringMatching(/^req-[a-z0-9]{8}$/),
        durationMs: expect.any(Number),
      });
    });

    it('should handle non-RpcError exceptions', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();
      const testError = new Error('Generic error');

      await expect(
        middleware(ctx, async () => {
          throw testError;
        })
      ).rejects.toThrow('Generic error');

      expect(mockLogger.logs).toHaveLength(1);
      const logEntry = getLogEntry(mockLogger.logs, 0);

      expect(logEntry.level).toBe('error');
      expect(logEntry.meta?.metadata).toMatchObject({
        status: 'error',
        error: 'Generic error',
        code: -32000,
      });
    });

    it('should log errors even when response is not set', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();

      await expect(
        middleware(ctx, async () => {
          throw new Error('Unhandled error');
        })
      ).rejects.toThrow('Unhandled error');

      expect(mockLogger.logs).toHaveLength(1);
      const entry = getLogEntry(mockLogger.logs, 0);
      expect(entry.level).toBe('error');
      expect(entry.meta?.metadata?.status).toBe('error');
    });
  });

  describe('logger configuration', () => {
    it('should use default console logger when no logger provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const middleware = loggerMiddleware();

        const ctx = createMockRequestContext();

        await middleware(ctx, async () => {
          ctx.response = encodeJsonRpcSuccess('1', {});
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          '[info]',
          'Request completed',
          expect.objectContaining({
            metadata: expect.objectContaining({
              status: 'ok',
              traceId: expect.any(String),
            }),
          })
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should use provided custom logger', async () => {
      const customLogger = createMockLogger();
      const middleware = loggerMiddleware({ baseLogger: customLogger });

      const ctx = createMockRequestContext();

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(customLogger.logs).toHaveLength(1);
      expect(getLogEntry(customLogger.logs, 0).level).toBe('info');
    });
  });

  describe('debug mode', () => {
    it('should enable debug logging when MCPKIT_DEBUG=1', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(mockLogger.logs).toHaveLength(2);
      const debugEntry = getLogEntry(mockLogger.logs, 0);
      const infoEntry = getLogEntry(mockLogger.logs, 1);
      expect(debugEntry.level).toBe('debug');
      expect(debugEntry.message).toBe('Request started');
      expect(infoEntry.level).toBe('info');
      expect(infoEntry.message).toBe('Request completed');
    });

    it('should include additional debug information in debug mode', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext({
        request: { ...SAMPLE_JSON_RPC_REQUEST, params: { test: 'value' } },
        transport: { name: 'stdio', peer: { ip: '127.0.0.1' } },
      });

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      const debugLog = getLogEntry(mockLogger.logs, 0);
      expect(debugLog.meta?.metadata).toMatchObject({
        method: expect.any(String),
        transport: 'stdio',
        traceId: expect.any(String),
      });
    });

    it('should not log debug messages when MCPKIT_DEBUG is not set', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(mockLogger.logs).toHaveLength(1);
      expect(getLogEntry(mockLogger.logs, 0).level).toBe('info');
    });
  });

  describe('warn level logging', () => {
    it('should support warn level logging via context logger', async () => {
      const middleware = loggerMiddleware({ baseLogger: mockLogger });

      const ctx = createMockRequestContext();
      let contextLogger: any;

      await middleware(ctx, async () => {
        contextLogger = (ctx as any).log;
        contextLogger.warn('Warning message', { warningType: 'test' });
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      // Should have 2 logs: warn + info (completion)
      expect(mockLogger.logs).toHaveLength(2);
      const warnEntry = getLogEntry(mockLogger.logs, 0);
      expect(warnEntry.level).toBe('warn');
      expect(warnEntry.message).toBe('Warning message');
      expect(warnEntry.meta?.metadata).toMatchObject({
        warningType: 'test',
        traceId: expect.any(String),
      });
    });
  });

  describe('built-in middleware integration', () => {
    it('should work with createBuiltInLoggingMiddleware', async () => {
      const logs: Array<{ level: string; message: string; data?: unknown }> = [];

      const customLogger = (level: string, message: string, data?: unknown) => {
        logs.push({ level, message, data });
      };

      const middleware = createBuiltInLoggingMiddleware({
        level: 'info',
        logger: customLogger,
      });

      const ctx = createMockRequestContext();

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.level).toBe('info');
      expect(logs[0]?.message).toBe('Request completed');
    });

    it('should support debug level in built-in middleware', async () => {
      const logs: Array<{ level: string; message: string; data?: unknown }> = [];

      const customLogger = (level: string, message: string, data?: unknown) => {
        logs.push({ level, message, data });
      };

      const middleware = createBuiltInLoggingMiddleware({
        level: 'debug',
        logger: customLogger,
      });

      const ctx = createMockRequestContext();

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(logs).toHaveLength(2);
      expect(logs[0]?.level).toBe('debug');
      expect(logs[0]?.message).toBe('Request started');
      expect(logs[1]?.level).toBe('info');
      expect(logs[1]?.message).toBe('Request completed');
    });

    it('should work without custom logger in built-in middleware', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const middleware = createBuiltInLoggingMiddleware({
          level: 'info',
        });

        const ctx = createMockRequestContext();

        await middleware(ctx, async () => {
          ctx.response = encodeJsonRpcSuccess('1', {});
        });

        expect(consoleSpy).toHaveBeenCalledWith('[info]', 'Request completed', expect.any(Object));
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should handle all log levels in built-in middleware', async () => {
      const logs: Array<{ level: string; message: string; data?: unknown }> = [];

      const customLogger = (level: string, message: string, data?: unknown) => {
        logs.push({ level, message, data });
      };

      const middleware = createBuiltInLoggingMiddleware({
        level: 'debug',
        logger: customLogger,
      });

      const ctx = createMockRequestContext();
      let contextLogger: any;

      await middleware(ctx, async () => {
        contextLogger = (ctx as any).log;
        contextLogger.error('Error message');
        contextLogger.warn('Warn message');
        contextLogger.info('Info message');
        contextLogger.debug('Debug message');
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      // Should have: debug start + error + warn + info + debug + info completion = 6 logs
      expect(logs.length).toBeGreaterThanOrEqual(5);

      const errorLog = logs.find((log) => log.message === 'Error message');
      const warnLog = logs.find((log) => log.message === 'Warn message');
      const infoLog = logs.find((log) => log.message === 'Info message');

      expect(errorLog?.level).toBe('error');
      expect(warnLog?.level).toBe('warn');
      expect(infoLog?.level).toBe('info');
    });
  });

  describe('integration with middleware chain', () => {
    it('should work correctly with other middleware', async () => {
      const logger = loggerMiddleware({ baseLogger: mockLogger });

      const executionOrder: string[] = [];
      const otherMiddleware: Middleware = async (_ctx, next) => {
        executionOrder.push('other:before');
        await next();
        executionOrder.push('other:after');
      };

      const ctx = createMockRequestContext();

      await logger(ctx, async () => {
        await otherMiddleware(ctx, async () => {
          executionOrder.push('handler');
          ctx.response = encodeJsonRpcSuccess('1', {});
        });
      });

      expect(executionOrder).toEqual(['other:before', 'handler', 'other:after']);
      expect(mockLogger.logs).toHaveLength(1);
      expect(ctx.state.traceId).toBeDefined();
    });

    it('should preserve traceId across middleware chain', async () => {
      const logger = loggerMiddleware({ baseLogger: mockLogger });

      let capturedTraceId: string | undefined;
      const otherMiddleware: Middleware = async (ctx, next) => {
        capturedTraceId = ctx.state.traceId as string;
        await next();
      };

      const ctx = createMockRequestContext();

      await logger(ctx, async () => {
        await otherMiddleware(ctx, async () => {
          ctx.response = encodeJsonRpcSuccess('1', {});
        });
      });

      expect(capturedTraceId).toBeDefined();
      const entry = getLogEntry(mockLogger.logs, 0);
      expect(entry.meta?.metadata?.traceId).toBe(capturedTraceId);
    });
  });

  describe('transport-aware logging', () => {
    it('should use stderr logger for stdio transport when no custom logger provided', async () => {
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      try {
        const middleware = createBuiltInLoggingMiddleware();

        const ctx = createMockRequestContext({
          transport: { name: 'stdio' },
        });

        await middleware(ctx, async () => {
          ctx.response = encodeJsonRpcSuccess('1', {});
        });

        expect(stderrSpy).toHaveBeenCalled();

        const stdoutCalls = stdoutSpy.mock.calls.filter((call) => {
          const content = call[0];
          if (typeof content === 'string') {
            return !content.includes('jsonrpc') && content.trim().length > 0;
          }
          const contentStr = new TextDecoder().decode(content);
          return !contentStr.includes('jsonrpc') && contentStr.trim().length > 0;
        });
        expect(stdoutCalls).toHaveLength(0);

        expect(stderrSpy.mock.calls).toHaveLength(1);
        const stderrCall = stderrSpy.mock.calls[0];
        if (!stderrCall) {
          throw new Error('Expected stderr call to be defined');
        }
        const logData = JSON.parse(stderrCall[0] as string);
        expect(logData).toMatchObject({
          level: 'info',
          message: 'Request completed',
          timestamp: expect.any(String),
        });
      } finally {
        stderrSpy.mockRestore();
        stdoutSpy.mockRestore();
      }
    });

    it('should use default logger for non-stdio transport', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const middleware = createBuiltInLoggingMiddleware();

        const ctx = createMockRequestContext({
          transport: { name: 'websocket' },
        });

        await middleware(ctx, async () => {
          ctx.response = encodeJsonRpcSuccess('1', {});
        });

        expect(consoleSpy).toHaveBeenCalledWith('[info]', 'Request completed', expect.any(Object));
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should use custom logger when provided, overriding transport detection', async () => {
      const customLogs: Array<{ level: string; message: string; data?: unknown }> = [];
      const customLogger = (level: string, message: string, data?: unknown) => {
        customLogs.push({ level, message, data });
      };

      const middleware = createBuiltInLoggingMiddleware({
        logger: customLogger,
      });

      const ctx = createMockRequestContext({
        transport: { name: 'stdio' },
      });

      await middleware(ctx, async () => {
        ctx.response = encodeJsonRpcSuccess('1', {});
      });

      expect(customLogs).toHaveLength(1);
      expect(customLogs[0]).toMatchObject({
        level: 'info',
        message: 'Request completed',
      });
    });
  });

  describe('createStreamingInfoMiddleware', () => {
    it('should add streamInfo method for non-stdio transports', async () => {
      const middleware = createStreamingInfoMiddleware();
      const sentMessages: unknown[] = [];

      const ctx = createMockRequestContext({
        transport: { name: 'websocket' },
        send: async (message: unknown) => {
          sentMessages.push(message);
        },
      });

      let streamingCtx: StreamingRequestContext;

      await middleware(ctx, async () => {
        streamingCtx = ctx as StreamingRequestContext;
        expect(streamingCtx.streamInfo).toBeDefined();

        if (streamingCtx.streamInfo) {
          await streamingCtx.streamInfo('Processing started');
          await streamingCtx.streamInfo('Processing completed');
        }
      });

      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0]).toEqual({ type: 'info', text: 'Processing started' });
      expect(sentMessages[1]).toEqual({ type: 'info', text: 'Processing completed' });
    });

    it('should not add streamInfo method for stdio transport', async () => {
      const middleware = createStreamingInfoMiddleware();

      const ctx = createMockRequestContext({
        transport: { name: 'stdio' },
      });

      let streamingCtx: StreamingRequestContext;

      await middleware(ctx, async () => {
        streamingCtx = ctx as StreamingRequestContext;
        expect(streamingCtx.streamInfo).toBeUndefined();
      });
    });

    it('should work with optional chaining pattern', async () => {
      const middleware = createStreamingInfoMiddleware();
      const sentMessages: unknown[] = [];

      const ctx = createMockRequestContext({
        transport: { name: 'http' },
        send: async (message: unknown) => {
          sentMessages.push(message);
        },
      });

      await middleware(ctx, async () => {
        const streamingCtx = ctx as StreamingRequestContext;

        // This should work for non-stdio transport
        streamingCtx.streamInfo?.('Optional chaining works');
      });

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({ type: 'info', text: 'Optional chaining works' });
    });

    it('should handle stdio transport with optional chaining gracefully', async () => {
      const middleware = createStreamingInfoMiddleware();

      const ctx = createMockRequestContext({
        transport: { name: 'stdio' },
      });

      await middleware(ctx, async () => {
        const streamingCtx = ctx as StreamingRequestContext;

        // This should not throw for stdio transport
        expect(() => {
          streamingCtx.streamInfo?.('This should be ignored');
        }).not.toThrow();
      });
    });

    it('should not add streamInfo method for unknown transport (builder default)', async () => {
      const middleware = createStreamingInfoMiddleware();

      const ctx = createMockRequestContext({
        transport: { name: 'unknown' },
      });

      let streamingCtx: StreamingRequestContext;

      await middleware(ctx, async () => {
        streamingCtx = ctx as StreamingRequestContext;
        expect(streamingCtx.streamInfo).toBeUndefined();
      });
    });

    it('should handle unknown transport with optional chaining gracefully', async () => {
      const middleware = createStreamingInfoMiddleware();

      const ctx = createMockRequestContext({
        transport: { name: 'unknown' },
      });

      await middleware(ctx, async () => {
        const streamingCtx = ctx as StreamingRequestContext;

        // This should not throw for unknown transport (stdio detection)
        expect(() => {
          streamingCtx.streamInfo?.('This should be ignored for unknown transport');
        }).not.toThrow();
      });
    });
  });
});

function getLogEntry(logs: MockLogger['logs'], index: number) {
  const entry = logs[index];
  if (!entry) {
    throw new Error(`Log entry at index ${index} is undefined`);
  }
  return entry;
}
