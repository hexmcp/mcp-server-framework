import type { LogEntry, Logger } from '../../src/middleware/types';
import {
  createChildLogger,
  createDefaultLogger,
  createOptimizedLogger,
  createSilentLogger,
  createStderrLogger,
  formatLogMetadata,
  generateTraceId,
  isDebugMode,
} from '../../src/utils/logger';

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
        const logger = createDefaultLogger({ disableInTest: false });
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
        const logger = createDefaultLogger({ disableInTest: false });
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

  describe('createStderrLogger', () => {
    it('should create a logger that writes to stderr only', () => {
      const logger = createStderrLogger();

      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.log).toBe('function');
    });

    it('should write structured JSON logs to stderr', () => {
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        const logger = createStderrLogger({ disableInTest: false });
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

        expect(stderrSpy).toHaveBeenCalledTimes(4);

        // Check that all calls write structured JSON to stderr
        stderrSpy.mock.calls.forEach((call, index) => {
          const logData = JSON.parse(call[0] as string);
          expect(logData).toMatchObject({
            level: ['error', 'warn', 'info', 'debug'][index],
            message: ['error message', 'warn message', 'info message', 'debug message'][index],
            timestamp: expect.any(String),
            meta: testEntry,
          });
        });
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('should handle log method with different levels', () => {
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        const logger = createStderrLogger({ disableInTest: false });

        logger.log('error', 'error via log');
        logger.log('warn', 'warn via log');
        logger.log('info', 'info via log');
        logger.log('debug', 'debug via log');

        expect(stderrSpy).toHaveBeenCalledTimes(4);

        stderrSpy.mock.calls.forEach((call, index) => {
          const logData = JSON.parse(call[0] as string);
          expect(logData).toMatchObject({
            level: ['error', 'warn', 'info', 'debug'][index],
            message: ['error via log', 'warn via log', 'info via log', 'debug via log'][index],
            timestamp: expect.any(String),
          });
        });
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('should not write to stdout', () => {
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        const logger = createStderrLogger({ disableInTest: false });
        logger.info('test message');

        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(stderrSpy).toHaveBeenCalledTimes(1);
      } finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });
  });

  describe('createSilentLogger', () => {
    it('should create a logger with all methods', () => {
      const logger = createSilentLogger();

      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.log).toBe('function');
    });

    it('should not write to any output streams', () => {
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const logger = createSilentLogger();
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
        logger.log('info', 'log message', testEntry);

        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(stderrSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
      } finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        logSpy.mockRestore();
      }
    });

    it('should be safe to call all methods without side effects', () => {
      const logger = createSilentLogger();

      // These should not throw or cause any side effects
      expect(() => {
        logger.error('error');
        logger.warn('warn');
        logger.info('info');
        logger.debug('debug');
        logger.log('info', 'log');
      }).not.toThrow();
    });
  });

  describe('createOptimizedLogger', () => {
    it('should return silent logger when silent option is true', () => {
      const logger = createOptimizedLogger({ silent: true });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        logger.info('test');
        logger.error('test');

        expect(consoleSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });

    it('should return stderr logger for stdio transport', () => {
      const stderrSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        const logger = createOptimizedLogger({
          transport: 'stdio',
          disableInTest: false,
        });

        logger.info('test');

        expect(stderrSpy).toHaveBeenCalledTimes(1);
        expect(stderrSpy.mock.calls[0]).toBeDefined();
        expect(stderrSpy.mock.calls[0]).toHaveLength(1);

        const options = stderrSpy.mock.calls[0] as [string];
        const logEntry = options[0];
        const logData = JSON.parse(logEntry);
        expect(logData).toMatchObject({
          level: 'info',
          message: 'test',
          timestamp: expect.any(String),
        });
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('should return default logger for non-stdio transport', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const logger = createOptimizedLogger({
          transport: 'websocket',
          disableInTest: false,
        });

        logger.info('test');

        expect(consoleSpy).toHaveBeenCalledWith('[info]', 'test', undefined);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should respect log level filtering', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        const logger = createOptimizedLogger({
          level: 'warn',
          disableInTest: false,
        });

        logger.debug('debug - should be ignored');
        logger.info('info - should be ignored');
        logger.warn('warn - should be logged');
        logger.error('error - should be logged');

        expect(consoleSpy).not.toHaveBeenCalled(); // debug and info should be ignored
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('[warn]', 'warn - should be logged', undefined);
        expect(errorSpy).toHaveBeenCalledWith('[error]', 'error - should be logged', undefined);
      } finally {
        consoleSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });
});
