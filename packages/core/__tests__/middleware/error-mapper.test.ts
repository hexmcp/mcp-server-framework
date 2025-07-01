import { JSON_RPC_ERROR_CODES, RpcError } from '@hexmcp/codec-jsonrpc';

import {
  createErrorMapperMiddleware,
  createErrorMapperMiddlewareWithDefaults,
  ErrorClassification,
  type Logger,
  MiddlewareError,
  MiddlewareTimeoutError,
  ReentrantCallError,
} from '../../src/middleware/index';
import { createMockRequestContext, SAMPLE_JSON_RPC_REQUEST } from '../fixtures/middleware-fixtures';

describe('Error Mapper Middleware', () => {
  let mockLogger: jest.Mocked<Logger>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MCPKIT_DEBUG;
  });

  describe('createErrorMapperMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createErrorMapperMiddleware();
      expect(middleware).toBeDefined();
      expect(middleware.name).toBe('ErrorMapperMiddleware');
    });

    it('should validate options and throw for invalid log level', () => {
      expect(() => {
        createErrorMapperMiddleware({ logLevel: 'invalid' as any });
      }).toThrow('Invalid log level: invalid');
    });

    it('should validate options and throw for invalid log format', () => {
      expect(() => {
        createErrorMapperMiddleware({ logFormat: 'invalid' as any });
      }).toThrow('Invalid log format: invalid');
    });

    it('should validate options and throw for invalid custom error mapper', () => {
      expect(() => {
        createErrorMapperMiddleware({ customErrorMapper: 'not-a-function' as any });
      }).toThrow('customErrorMapper must be a function');
    });

    it('should validate options and throw for invalid logger', () => {
      expect(() => {
        createErrorMapperMiddleware({ logger: { invalid: true } as any });
      }).toThrow('logger must implement the Logger interface');
    });
  });

  describe('createErrorMapperMiddlewareWithDefaults', () => {
    it('should create middleware with sensible defaults', () => {
      const middleware = createErrorMapperMiddlewareWithDefaults();
      expect(middleware).toBeDefined();
      expect(middleware.name).toBe('ErrorMapperMiddleware');
    });
  });

  describe('error handling', () => {
    it('should pass through when no error occurs', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.response).toBeUndefined();
    });

    it('should handle RpcError and preserve original properties', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new RpcError(-32601, 'Method not found', { extra: 'data' });
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
      expect(response.error.data).toEqual({ extra: 'data' });
    });

    it('should handle MiddlewareError and convert to internal error', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new MiddlewareError('Test middleware error', 1);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Internal error');
    });

    it('should handle MiddlewareTimeoutError with debug info', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new MiddlewareTimeoutError(5000, 2);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.data).toBeDefined();
      expect(response.error.data.classification).toBe(ErrorClassification.MIDDLEWARE_TIMEOUT);
      expect(response.error.data.severity).toBe('high');
    });

    it('should handle ReentrantCallError as critical', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new ReentrantCallError('exec-123');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.data.severity).toBe('critical');
      expect(response.error.data.executionId).toBe('exec-123');
    });

    it('should handle standard Error objects', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new Error('Standard error message');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Internal error');
    });

    it('should handle null and undefined errors', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx1 = createMockRequestContext();
      const ctx2 = createMockRequestContext();
      const next1 = jest.fn().mockRejectedValue(null);
      const next2 = jest.fn().mockRejectedValue(undefined);

      await middleware(ctx1, next1);
      await middleware(ctx2, next2);

      expect(ctx1.response).toBeDefined();
      expect(ctx2.response).toBeDefined();
      const response1 = ctx1.response as any;
      const response2 = ctx2.response as any;
      expect(response1.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response2.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });

    it('should classify validation errors correctly', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new Error('Validation failed for parameter');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data.classification).toBe(ErrorClassification.VALIDATION_ERROR);
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    });

    it('should classify authentication errors correctly', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new Error('Authentication failed');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data.classification).toBe(ErrorClassification.AUTHENTICATION_ERROR);
      expect(response.error.code).toBe(-32001);
    });
  });

  describe('debug mode', () => {
    it('should include debug info when MCPKIT_DEBUG=1', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error with stack');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.originalMessage).toBe('Test error with stack');
    });

    it('should not include debug info in production mode', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
    });

    it('should override environment debug mode with options', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware({ debugMode: false });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
    });
  });

  describe('custom error mapper', () => {
    it('should use custom error mapper when provided', async () => {
      const customMapper = jest.fn().mockReturnValue({
        code: -32000,
        message: 'Custom error message',
        data: { custom: true },
      });

      const middleware = createErrorMapperMiddleware({ customErrorMapper: customMapper });
      const ctx = createMockRequestContext();
      const originalError = new Error('Original error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(customMapper).toHaveBeenCalledWith(originalError, ctx);
      const response = ctx.response as any;
      expect(response.error.code).toBe(-32000);
      expect(response.error.message).toBe('Custom error message');
      expect(response.error.data).toEqual({ custom: true });
    });

    it('should fallback to default mapping when custom mapper throws', async () => {
      const customMapper = jest.fn().mockImplementation(() => {
        throw new Error('Mapper failed');
      });

      const middleware = createErrorMapperMiddleware({ customErrorMapper: customMapper });
      const ctx = createMockRequestContext();
      const originalError = new Error('Original error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Custom error mapper failed, falling back to default mapping:', expect.any(Error));
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('structured logging', () => {
    it('should log errors when logging is enabled', async () => {
      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        logLevel: 'error',
        includeRequestContext: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error for logging');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Middleware error caught by error mapper');
      expect(logEntry.error).toBeDefined();
      expect(logEntry.context).toBeDefined();
    });

    it('should not log when logging is disabled', async () => {
      const middleware = createErrorMapperMiddleware({ enableLogging: false });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should use custom logger when provided', async () => {
      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        logger: mockLogger,
        logLevel: 'warn',
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(mockLogger.log).toHaveBeenCalledWith('warn', expect.any(String), expect.any(Object));
    });

    it('should include request context in logs when enabled', async () => {
      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        includeRequestContext: true,
      });
      const ctx = createMockRequestContext({
        request: { ...SAMPLE_JSON_RPC_REQUEST, id: 'test-123', method: 'test/method' },
      });
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.context.requestId).toBe('test-123');
      expect(logEntry.context.method).toBe('test/method');
      expect(logEntry.context.transport).toBe('test-transport');
    });

    it('should support text log format', async () => {
      process.env.MCPKIT_DEBUG = '1';
      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        logFormat: 'text',
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.message).toContain('[LOW]');
      expect(logEntry.message).toContain('standard_error');
    });

    it('should include correlation ID and metadata', async () => {
      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        logFields: {
          traceId: 'trace-123',
          spanId: 'span-456',
          correlationId: 'corr-789',
          customFields: { service: 'test-service' },
        },
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.metadata.traceId).toBe('trace-123');
      expect(logEntry.metadata.spanId).toBe('span-456');
      expect(logEntry.metadata.correlationId).toBe('corr-789');
      expect(logEntry.metadata.service).toBe('test-service');
    });
  });

  describe('onError hook', () => {
    it('should call onError hook when provided', async () => {
      const onErrorHook = jest.fn();
      const middleware = createErrorMapperMiddleware({ onError: onErrorHook });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(onErrorHook).toHaveBeenCalledWith(
        originalError,
        ctx,
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal error',
        })
      );
    });

    it('should handle errors in onError hook gracefully', async () => {
      const onErrorHook = jest.fn().mockImplementation(() => {
        throw new Error('Hook failed');
      });
      const middleware = createErrorMapperMiddleware({ onError: onErrorHook });
      const ctx = createMockRequestContext();
      const originalError = new Error('Test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Error in onError hook:', expect.any(Error));
      expect(ctx.response).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle circular reference errors', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;
      const originalError = new Error('Circular error');
      (originalError as any).circular = circularObj;
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });

    it('should handle errors with very long messages', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const longMessage = 'A'.repeat(10000);
      const originalError = new Error(longMessage);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });

    it('should handle non-Error objects thrown as errors', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const stringError = 'String error message';
      const next = jest.fn().mockRejectedValue(stringError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });

    it('should handle errors with no message', async () => {
      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new Error();
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(ctx.response).toBeDefined();
      const response = ctx.response as any;
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    });
  });
});
