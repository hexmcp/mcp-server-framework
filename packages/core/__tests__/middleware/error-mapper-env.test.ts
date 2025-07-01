import { JSON_RPC_ERROR_CODES, RpcError } from '@hexmcp/codec-jsonrpc';

import {
  createErrorMapperMiddleware,
  ErrorClassification,
  MiddlewareError,
  MiddlewareTimeoutError,
  ReentrantCallError,
} from '../../src/middleware/index';
import { createMockRequestContext } from '../fixtures/middleware-fixtures';

describe('Error Mapper Environment Variable Integration', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MCPKIT_DEBUG;
    delete process.env.NODE_ENV;
  });

  describe('MCPKIT_DEBUG environment variable', () => {
    it('should enable debug mode when MCPKIT_DEBUG=1', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new Error('Debug mode test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.classification).toBe(ErrorClassification.STANDARD_ERROR);
      expect(response.error.data.originalMessage).toBe('Debug mode test error');
      expect(response.error.data.originalType).toBe('Error');
    });

    it('should disable debug mode when MCPKIT_DEBUG is not set', async () => {
      // Ensure MCPKIT_DEBUG is not set
      delete process.env.MCPKIT_DEBUG;

      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new Error('Production mode test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Internal error');
    });

    it('should disable debug mode when MCPKIT_DEBUG=0', async () => {
      process.env.MCPKIT_DEBUG = '0';

      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new Error('Debug disabled test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
    });

    it('should disable debug mode when MCPKIT_DEBUG=false', async () => {
      process.env.MCPKIT_DEBUG = 'false';

      const middleware = createErrorMapperMiddleware({ includeStackTrace: true });
      const ctx = createMockRequestContext();
      const originalError = new Error('Debug false test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
    });

    it('should override environment debug mode with explicit options', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware({
        debugMode: false,
        includeStackTrace: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Override test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
    });

    it('should enable debug mode with explicit options even when env var is not set', async () => {
      delete process.env.MCPKIT_DEBUG;

      const middleware = createErrorMapperMiddleware({
        debugMode: true,
        includeStackTrace: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Explicit debug test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.originalMessage).toBe('Explicit debug test error');
    });
  });

  describe('stack trace handling', () => {
    it('should include stack traces in debug mode when includeStackTrace is true', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware({
        includeStackTrace: true,
        enableLogging: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Stack trace test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data.stack).toBeDefined();
      expect(response.error.data.stack).toContain('Stack trace test error');

      // Verify logging also includes stack trace
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.stack).toBeDefined();
    });

    it('should exclude stack traces in debug mode when includeStackTrace is false', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware({
        includeStackTrace: false,
        enableLogging: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('No stack trace test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data.stack).toBeUndefined();

      // Verify logging also excludes stack trace
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.stack).toBeUndefined();
    });

    it('should never include stack traces in production mode regardless of includeStackTrace', async () => {
      delete process.env.MCPKIT_DEBUG;

      const middleware = createErrorMapperMiddleware({
        includeStackTrace: true,
        enableLogging: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Production stack trace test');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();

      // Verify logging behavior in production
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.stack).toBeUndefined();
    });
  });

  describe('RpcError integration', () => {
    it('should preserve RpcError debug behavior in debug mode', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new RpcError(-32601, 'Method not found', { extra: 'debug data' });
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
      expect(response.error.data).toEqual({ extra: 'debug data' });

      // RpcError should preserve its own debug behavior
      expect(originalError.debugStack).toBeDefined();
    });

    it('should preserve RpcError production behavior in production mode', async () => {
      delete process.env.MCPKIT_DEBUG;

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new RpcError(-32601, 'Method not found', { extra: 'production data' });
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
      expect(response.error.data).toEqual({ extra: 'production data' });
    });
  });

  describe('middleware-specific error debug info', () => {
    it('should include middleware error details in debug mode', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new MiddlewareError('Middleware failed', 3);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.classification).toBe(ErrorClassification.MIDDLEWARE_ERROR);
      expect(response.error.data.middlewareIndex).toBe(3);
      expect(response.error.data.originalMessage).toBe('Middleware failed');
    });

    it('should include timeout error details in debug mode', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new MiddlewareTimeoutError(5000, 2);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.classification).toBe(ErrorClassification.MIDDLEWARE_TIMEOUT);
      expect(response.error.data.additionalData.timeout).toBe(5000);
      expect(response.error.data.additionalData.middlewareIndex).toBe(2);
    });

    it('should include reentrant call error details in debug mode', async () => {
      process.env.MCPKIT_DEBUG = '1';

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new ReentrantCallError('exec-123');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeDefined();
      expect(response.error.data.classification).toBe(ErrorClassification.REENTRANT_CALL);
      expect(response.error.data.executionId).toBe('exec-123');
      expect(response.error.data.severity).toBe('critical');
    });

    it('should hide middleware error details in production mode', async () => {
      delete process.env.MCPKIT_DEBUG;

      const middleware = createErrorMapperMiddleware();
      const ctx = createMockRequestContext();
      const originalError = new MiddlewareError('Sensitive middleware info', 5);
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      const response = ctx.response as any;
      expect(response.error.data).toBeUndefined();
      expect(response.error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Internal error');
    });
  });

  describe('logging environment integration', () => {
    it('should include environment metadata in logs', async () => {
      process.env.MCPKIT_DEBUG = '1';
      process.env.NODE_ENV = 'test';

      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
        includeRequestContext: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Environment test error');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.metadata.environment).toBe('test');
      expect(logEntry.metadata.source).toBe('error-mapper');
      expect(logEntry.metadata.correlationId).toMatch(/^err-\d+-[a-z0-9]+$/);
    });

    it('should default to development environment when NODE_ENV is not set', async () => {
      process.env.MCPKIT_DEBUG = '1';
      delete process.env.NODE_ENV;

      const middleware = createErrorMapperMiddleware({
        enableLogging: true,
      });
      const ctx = createMockRequestContext();
      const originalError = new Error('Default environment test');
      const next = jest.fn().mockRejectedValue(originalError);

      await middleware(ctx, next);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.metadata.environment).toBe('development');
    });
  });
});
