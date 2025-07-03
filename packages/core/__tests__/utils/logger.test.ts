import type { LogEntry, Logger } from '../../src/middleware/types';
import { createChildLogger, createDefaultLogger, formatLogMetadata, generateTraceId, isDebugMode } from '../../src/utils/logger';

describe('Logger Utilities', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
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

  describe('generateTraceId', () => {
    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();

      expect(id1).toMatch(/^req-[a-z0-9]{8}$/);
      expect(id2).toMatch(/^req-[a-z0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('isDebugMode', () => {
    it('should return false when MCPKIT_DEBUG is not set', () => {
      expect(isDebugMode()).toBe(false);
    });

    it('should return true when MCPKIT_DEBUG=1', () => {
      process.env.MCPKIT_DEBUG = '1';
      expect(isDebugMode()).toBe(true);
    });

    it('should return false when MCPKIT_DEBUG is set to other values', () => {
      process.env.MCPKIT_DEBUG = 'true';
      expect(isDebugMode()).toBe(false);

      process.env.MCPKIT_DEBUG = '0';
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('formatLogMetadata', () => {
    it('should remove undefined and null values', () => {
      const input = {
        validString: 'test',
        validNumber: 42,
        undefinedValue: undefined,
        nullValue: null,
        validBoolean: false,
        emptyString: '',
      };

      const result = formatLogMetadata(input);

      expect(result).toEqual({
        validString: 'test',
        validNumber: 42,
        validBoolean: false,
        emptyString: '',
      });
    });

    it('should handle empty objects', () => {
      expect(formatLogMetadata({})).toEqual({});
    });

    it('should handle objects with only null/undefined values', () => {
      const input = {
        undefinedValue: undefined,
        nullValue: null,
      };

      expect(formatLogMetadata(input)).toEqual({});
    });
  });

  describe('createDefaultLogger', () => {
    it('should create a logger with console methods', () => {
      const logger = createDefaultLogger();

      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.log).toBe('function');
    });

    it('should log to console methods', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const logger = createDefaultLogger();
        const testEntry: LogEntry = {
          timestamp: Date.now(),
          level: 'info',
          message: 'test',
          metadata: {
            source: 'error-mapper',
            version: '1.0.0',
            environment: 'test',
          },
        };

        logger.error('error message', testEntry);
        logger.warn('warn message', testEntry);
        logger.info('info message', testEntry);
        logger.debug('debug message', testEntry);

        expect(errorSpy).toHaveBeenCalledWith('[error]', 'error message', testEntry);
        expect(warnSpy).toHaveBeenCalledWith('[warn]', 'warn message', testEntry);
        expect(logSpy).toHaveBeenCalledWith('[info]', 'info message', testEntry);
        expect(logSpy).toHaveBeenCalledWith('[debug]', 'debug message', testEntry);
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
      }
    });

    it('should handle log method with different levels', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const logger = createDefaultLogger();
        const testEntry: LogEntry = {
          timestamp: Date.now(),
          level: 'info',
          message: 'test',
          metadata: {
            source: 'error-mapper',
            version: '1.0.0',
            environment: 'test',
          },
        };

        logger.log('error', 'error via log', testEntry);
        logger.log('warn', 'warn via log', testEntry);
        logger.log('info', 'info via log', testEntry);
        logger.log('debug', 'debug via log', testEntry);

        expect(errorSpy).toHaveBeenCalledWith('[error]', 'error via log', testEntry);
        expect(warnSpy).toHaveBeenCalledWith('[warn]', 'warn via log', testEntry);
        expect(logSpy).toHaveBeenCalledWith('[info]', 'info via log', testEntry);
        expect(logSpy).toHaveBeenCalledWith('[debug]', 'debug via log', testEntry);
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
      }
    });
  });

  describe('createChildLogger', () => {
    it('should use child method if available (Pino/Bunyan style)', () => {
      const childLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };

      const baseLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        child: jest.fn().mockReturnValue(childLogger),
      } as Logger & { child: (meta: Record<string, unknown>) => Logger };

      const metadata = { traceId: 'test-123', service: 'test' };
      const result = createChildLogger(baseLogger, metadata);

      expect(baseLogger.child).toHaveBeenCalledWith(metadata);
      expect(result).toBe(childLogger);
    });

    it('should create wrapper logger when child method not available', () => {
      const baseLogger: Logger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };

      const metadata = { traceId: 'test-123', service: 'test' };
      const childLogger = createChildLogger(baseLogger, metadata);

      const testEntry: LogEntry = {
        timestamp: Date.now(),
        level: 'info',
        message: 'test',
        metadata: {
          source: 'error-mapper',
          version: '1.0.0',
          environment: 'test',
        },
      };

      childLogger.error('error message', testEntry);
      childLogger.warn('warn message', testEntry);
      childLogger.info('info message', testEntry);
      childLogger.debug('debug message', testEntry);
      childLogger.log('info', 'log message', testEntry);

      expect(baseLogger.error).toHaveBeenCalledWith('error message', testEntry);
      expect(baseLogger.warn).toHaveBeenCalledWith('warn message', testEntry);
      expect(baseLogger.info).toHaveBeenCalledWith('info message', testEntry);
      expect(baseLogger.debug).toHaveBeenCalledWith('debug message', testEntry);
      expect(baseLogger.log).toHaveBeenCalledWith('info', 'log message', testEntry);
    });
  });
});
