import {
  createPartiallyFailingStreamHandler,
  createRandomlyFailingStreamHandler,
  createStreamErrorChunk,
  isErrorChunk,
  type JsonRpcErrorChunk,
  type StreamErrorPattern,
  separateStreamErrors,
  validateStreamErrorPattern,
  withStreamTimeout,
  wrapStreamingOutput,
} from '../src';

describe('Streaming Error Fixtures', () => {
  describe('createStreamErrorChunk', () => {
    it('should create error chunk from Error object', () => {
      const error = new Error('Test error message');
      const chunk = createStreamErrorChunk(error);

      expect(chunk).toEqual({
        type: 'error',
        code: -32000,
        message: 'Test error message',
      });
    });

    it('should include stack trace when requested', () => {
      const error = new Error('Test error');
      const chunk = createStreamErrorChunk(error, { includeStackTrace: true });

      expect(chunk.type).toBe('error');
      expect(chunk.data).toEqual({
        name: 'Error',
        stack: expect.stringContaining('Test error'),
        cause: undefined,
      });
    });

    it('should extract error code from structured errors', () => {
      const error = { code: -32601, message: 'Method not found', data: { method: 'test' } };
      const chunk = createStreamErrorChunk(error);

      expect(chunk).toEqual({
        type: 'error',
        code: -32601,
        message: 'Method not found',
        data: { method: 'test' },
      });
    });

    it('should handle string errors', () => {
      const chunk = createStreamErrorChunk('Simple error message');

      expect(chunk).toEqual({
        type: 'error',
        code: -32000,
        message: 'Simple error message',
      });
    });

    it('should use custom error chunk factory', () => {
      const customFactory = (error: unknown): JsonRpcErrorChunk => ({
        type: 'error',
        code: -99999,
        message: `Custom: ${(error as Error).message}`,
        data: { custom: true },
      });

      const error = new Error('Test');
      const chunk = createStreamErrorChunk(error, { onErrorChunk: customFactory });

      expect(chunk).toEqual({
        type: 'error',
        code: -99999,
        message: 'Custom: Test',
        data: { custom: true },
      });
    });
  });

  describe('wrapStreamingOutput', () => {
    it('should pass through successful chunks', async () => {
      const successfulStream = async function* () {
        yield { type: 'text', content: 'chunk 1' };
        yield { type: 'text', content: 'chunk 2' };
        yield { type: 'event', name: 'complete' };
      };

      const wrappedStream = wrapStreamingOutput(successfulStream());
      const chunks: unknown[] = [];

      for await (const chunk of wrappedStream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { type: 'text', content: 'chunk 1' },
        { type: 'text', content: 'chunk 2' },
        { type: 'event', name: 'complete' },
      ]);
    });

    it('should convert thrown errors to error chunks', async () => {
      const failingStream = async function* () {
        yield { type: 'text', content: 'success chunk' };
        throw new Error('Stream failed');
      };

      const wrappedStream = wrapStreamingOutput(failingStream());
      const chunks: unknown[] = [];

      for await (const chunk of wrappedStream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'text', content: 'success chunk' });
      expect(chunks[1]).toEqual({
        type: 'error',
        code: -32000,
        message: 'Stream failed',
      });
    });

    it('should enforce maximum chunk limits', async () => {
      const longStream = async function* () {
        for (let i = 0; i < 100; i++) {
          yield { type: 'text', content: `chunk ${i}` };
        }
      };

      const wrappedStream = wrapStreamingOutput(longStream(), { maxChunks: 5 });
      const chunks: unknown[] = [];

      for await (const chunk of wrappedStream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(6); // 5 successful + 1 error
      expect(chunks[5]).toEqual({
        type: 'error',
        code: -32000,
        message: 'Stream exceeded maximum chunk limit of 5',
      });
    });
  });

  describe('createPartiallyFailingStreamHandler', () => {
    it('should emit success chunks followed by error', async () => {
      const successChunks = [
        { type: 'text', content: 'chunk 1' },
        { type: 'text', content: 'chunk 2' },
      ];
      const error = new Error('Partial failure');

      const handler = createPartiallyFailingStreamHandler(successChunks, error);
      const chunks: unknown[] = [];

      for await (const chunk of handler({})) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text', content: 'chunk 1' });
      expect(chunks[1]).toEqual({ type: 'text', content: 'chunk 2' });
      expect(chunks[2]).toEqual({
        type: 'error',
        code: -32000,
        message: 'Partial failure',
      });
    });
  });

  describe('createRandomlyFailingStreamHandler', () => {
    it('should sometimes succeed and sometimes fail', async () => {
      const chunks = [
        { type: 'text', content: 'chunk 1' },
        { type: 'text', content: 'chunk 2' },
        { type: 'text', content: 'chunk 3' },
      ];

      // Test with 100% failure rate to ensure deterministic behavior
      const handler = createRandomlyFailingStreamHandler(chunks, 1.0);
      const result = [];

      for await (const chunk of handler({})) {
        result.push(chunk);
      }

      expect(result).toHaveLength(1);
      expect(isErrorChunk(result[0])).toBe(true);
      expect((result[0] as JsonRpcErrorChunk).message).toContain('Random failure at chunk 1/3');
    });

    it('should complete successfully with 0% failure rate', async () => {
      const chunks = [
        { type: 'text', content: 'chunk 1' },
        { type: 'text', content: 'chunk 2' },
      ];

      const handler = createRandomlyFailingStreamHandler(chunks, 0.0);
      const result = [];

      for await (const chunk of handler({})) {
        result.push(chunk);
      }

      expect(result).toEqual(chunks);
    });
  });

  describe('validateStreamErrorPattern', () => {
    it('should validate successful stream pattern', async () => {
      const stream = async function* () {
        yield { type: 'text', content: 'chunk 1' };
        yield { type: 'text', content: 'chunk 2' };
      };

      const pattern: StreamErrorPattern = {
        successCount: 2,
        endsWithError: false,
      };

      const result = await validateStreamErrorPattern(stream(), pattern);

      expect(result.valid).toBe(true);
      expect(result.chunks).toHaveLength(2);
    });

    it('should validate error stream pattern', async () => {
      const stream = async function* () {
        yield { type: 'text', content: 'success' };
        yield { type: 'error', code: -32001, message: 'Expected error' };
      };

      const pattern: StreamErrorPattern = {
        successCount: 1,
        errorCode: -32001,
        errorMessage: 'Expected error',
        endsWithError: true,
      };

      const result = await validateStreamErrorPattern(stream(), pattern);

      expect(result.valid).toBe(true);
      expect(result.chunks).toHaveLength(2);
    });

    it('should detect pattern mismatches', async () => {
      const stream = async function* () {
        yield { type: 'text', content: 'chunk 1' };
        yield { type: 'text', content: 'chunk 2' };
        yield { type: 'text', content: 'chunk 3' };
      };

      const pattern: StreamErrorPattern = {
        successCount: 2, // Expected 2, but stream has 3
        endsWithError: false,
      };

      const result = await validateStreamErrorPattern(stream(), pattern);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Expected 2 successful chunks, got 3');
    });

    it('should validate error message patterns with regex', async () => {
      const stream = async function* () {
        yield { type: 'error', code: -32000, message: 'Error: timeout after 5000ms' };
      };

      const pattern: StreamErrorPattern = {
        successCount: 0,
        errorMessage: /timeout after \d+ms/,
        endsWithError: true,
      };

      const result = await validateStreamErrorPattern(stream(), pattern);

      expect(result.valid).toBe(true);
    });
  });

  describe('isErrorChunk', () => {
    it('should identify valid error chunks', () => {
      const errorChunk = {
        type: 'error',
        code: -32000,
        message: 'Test error',
      };

      expect(isErrorChunk(errorChunk)).toBe(true);
    });

    it('should reject non-error chunks', () => {
      const textChunk = { type: 'text', content: 'hello' };
      const invalidChunk = { type: 'error' }; // Missing required fields

      expect(isErrorChunk(textChunk)).toBe(false);
      expect(isErrorChunk(invalidChunk)).toBe(false);
      expect(isErrorChunk(null)).toBe(false);
      expect(isErrorChunk('string')).toBe(false);
    });
  });

  describe('separateStreamErrors', () => {
    it('should separate success and error chunks', async () => {
      const stream = async function* () {
        yield { type: 'text', content: 'success 1' };
        yield { type: 'error', code: -32000, message: 'error 1' };
        yield { type: 'text', content: 'success 2' };
        yield { type: 'error', code: -32001, message: 'error 2' };
      };

      const { successChunks, errorChunks } = await separateStreamErrors(stream());

      expect(successChunks).toEqual([
        { type: 'text', content: 'success 1' },
        { type: 'text', content: 'success 2' },
      ]);

      expect(errorChunks).toEqual([
        { type: 'error', code: -32000, message: 'error 1' },
        { type: 'error', code: -32001, message: 'error 2' },
      ]);
    });
  });

  describe('withStreamTimeout', () => {
    it('should pass through fast streams', async () => {
      const fastStream = async function* () {
        yield { type: 'text', content: 'fast chunk' };
      };

      const timeoutStream = withStreamTimeout(fastStream(), 1000);
      const chunks: unknown[] = [];

      for await (const chunk of timeoutStream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([{ type: 'text', content: 'fast chunk' }]);
    });

    it('should emit timeout error for slow streams', async () => {
      const slowStream = async function* () {
        yield { type: 'text', content: 'first chunk' };
        await new Promise((resolve) => setTimeout(resolve, 200)); // Delay longer than timeout
        yield { type: 'text', content: 'slow chunk' };
      };

      const timeoutStream = withStreamTimeout(slowStream(), 100);
      const chunks: unknown[] = [];

      for await (const chunk of timeoutStream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'text', content: 'first chunk' });
      expect(isErrorChunk(chunks[1])).toBe(true);
      expect((chunks[1] as JsonRpcErrorChunk).code).toBe(-32001);
      expect((chunks[1] as JsonRpcErrorChunk).message).toContain('timed out after 100ms');
    });
  });
});
