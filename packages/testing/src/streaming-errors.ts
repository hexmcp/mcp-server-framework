import type { JsonRpcChunk, JsonRpcErrorChunk } from './types';

/**
 * Options for wrapping streaming output with error handling
 */
export interface StreamErrorOptions {
  /** Custom function to convert errors to error chunks */
  onErrorChunk?: (error: unknown) => JsonRpcErrorChunk;
  /** Whether to include stack traces in error data */
  includeStackTrace?: boolean;
  /** Maximum number of chunks to emit before forcing termination */
  maxChunks?: number;
}

/**
 * Default error chunk factory that converts any error to a structured error chunk
 */
export function createStreamErrorChunk(error: unknown, options: StreamErrorOptions = {}): JsonRpcErrorChunk {
  if (options.onErrorChunk) {
    return options.onErrorChunk(error);
  }

  let code = -32000; // Default internal error code
  let message = 'Unknown error occurred during streaming';
  let data: unknown;

  if (error instanceof Error) {
    message = error.message;
    if (options.includeStackTrace) {
      data = {
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      };
    }

    // Extract error code if it's a structured error
    if ('code' in error && typeof error.code === 'number') {
      code = error.code;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    // Try to extract structured error information
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      message = errorObj.message;
    }
    if (typeof errorObj.code === 'number') {
      code = errorObj.code;
    }
    if (errorObj.data !== undefined) {
      data = errorObj.data;
    }
  }

  return {
    type: 'error',
    code,
    message,
    ...(data !== undefined && { data }),
  };
}

/**
 * Wraps an AsyncIterable to catch errors and emit them as structured error chunks
 * instead of throwing exceptions. This enables testing of partial stream success.
 */
export async function* wrapStreamingOutput<T>(
  stream: AsyncIterable<T>,
  options: StreamErrorOptions = {}
): AsyncIterable<T | JsonRpcErrorChunk> {
  let chunkCount = 0;
  const maxChunks = options.maxChunks || Number.MAX_SAFE_INTEGER;

  try {
    for await (const chunk of stream) {
      if (chunkCount >= maxChunks) {
        yield createStreamErrorChunk(new Error(`Stream exceeded maximum chunk limit of ${maxChunks}`), options);
        return;
      }

      yield chunk;
      chunkCount++;
    }
  } catch (error) {
    // Convert the error to a structured error chunk
    yield createStreamErrorChunk(error, options);
  }
}

/**
 * Creates a streaming handler that emits some successful chunks followed by an error.
 * Useful for testing partial success scenarios.
 */
export function createPartiallyFailingStreamHandler<TInput, TOutput>(
  successChunks: TOutput[],
  error: unknown,
  options: StreamErrorOptions = {}
): (input: TInput) => AsyncIterable<TOutput | JsonRpcErrorChunk> {
  return async function* (_input: TInput) {
    // Emit successful chunks first
    for (const chunk of successChunks) {
      yield chunk;
    }

    // Then emit the error chunk
    yield createStreamErrorChunk(error, options);
  };
}

/**
 * Creates a streaming handler that randomly fails at different points.
 * Useful for testing error handling robustness.
 */
export function createRandomlyFailingStreamHandler<TInput, TOutput>(
  chunks: TOutput[],
  failureRate = 0.3,
  options: StreamErrorOptions = {}
): (input: TInput) => AsyncIterable<TOutput | JsonRpcErrorChunk> {
  return async function* (_input: TInput) {
    for (let i = 0; i < chunks.length; i++) {
      if (Math.random() < failureRate) {
        yield createStreamErrorChunk(new Error(`Random failure at chunk ${i + 1}/${chunks.length}`), options);
        return;
      }
      const chunk = chunks[i];
      if (chunk !== undefined) {
        yield chunk;
      }
    }
  };
}

/**
 * Validates that a stream contains the expected pattern of success and error chunks
 */
export interface StreamErrorPattern {
  /** Expected number of successful chunks before error */
  successCount: number;
  /** Expected error code in the error chunk */
  errorCode?: number;
  /** Expected error message pattern (regex or string) */
  errorMessage?: string | RegExp;
  /** Whether the stream should end with an error */
  endsWithError: boolean;
}

/**
 * Validates a stream against an expected error pattern
 */
export async function validateStreamErrorPattern<T>(
  stream: AsyncIterable<T | JsonRpcErrorChunk>,
  pattern: StreamErrorPattern
): Promise<{ valid: boolean; reason?: string; chunks: (T | JsonRpcErrorChunk)[] }> {
  const chunks: (T | JsonRpcErrorChunk)[] = [];
  let successCount = 0;
  let _errorCount = 0;
  let lastChunkWasError = false;

  try {
    for await (const chunk of stream) {
      chunks.push(chunk);

      if (isErrorChunk(chunk)) {
        _errorCount++;
        lastChunkWasError = true;

        // Validate error code if specified
        if (pattern.errorCode !== undefined && chunk.code !== pattern.errorCode) {
          return {
            valid: false,
            reason: `Expected error code ${pattern.errorCode}, got ${chunk.code}`,
            chunks,
          };
        }

        // Validate error message if specified
        if (pattern.errorMessage !== undefined) {
          const messageMatches =
            typeof pattern.errorMessage === 'string' ? chunk.message === pattern.errorMessage : pattern.errorMessage.test(chunk.message);

          if (!messageMatches) {
            return {
              valid: false,
              reason: `Error message "${chunk.message}" does not match expected pattern`,
              chunks,
            };
          }
        }
      } else {
        successCount++;
        lastChunkWasError = false;
      }
    }
  } catch (error) {
    return {
      valid: false,
      reason: `Stream threw unexpected error: ${(error as Error).message}`,
      chunks,
    };
  }

  // Validate success count
  if (successCount !== pattern.successCount) {
    return {
      valid: false,
      reason: `Expected ${pattern.successCount} successful chunks, got ${successCount}`,
      chunks,
    };
  }

  // Validate ending condition
  if (pattern.endsWithError && !lastChunkWasError) {
    return {
      valid: false,
      reason: 'Expected stream to end with error chunk',
      chunks,
    };
  }

  if (!pattern.endsWithError && lastChunkWasError) {
    return {
      valid: false,
      reason: 'Expected stream to end successfully, but ended with error',
      chunks,
    };
  }

  return { valid: true, chunks };
}

/**
 * Type guard to check if a chunk is an error chunk
 */
export function isErrorChunk(chunk: unknown): chunk is JsonRpcErrorChunk {
  return (
    typeof chunk === 'object' &&
    chunk !== null &&
    'type' in chunk &&
    (chunk as JsonRpcChunk).type === 'error' &&
    'code' in chunk &&
    typeof (chunk as JsonRpcErrorChunk).code === 'number' &&
    'message' in chunk &&
    typeof (chunk as JsonRpcErrorChunk).message === 'string'
  );
}

/**
 * Filters a stream to separate successful chunks from error chunks
 */
export async function separateStreamErrors<T>(
  stream: AsyncIterable<T | JsonRpcErrorChunk>
): Promise<{ successChunks: T[]; errorChunks: JsonRpcErrorChunk[] }> {
  const successChunks: T[] = [];
  const errorChunks: JsonRpcErrorChunk[] = [];

  for await (const chunk of stream) {
    if (isErrorChunk(chunk)) {
      errorChunks.push(chunk);
    } else {
      successChunks.push(chunk);
    }
  }

  return { successChunks, errorChunks };
}

/**
 * Creates a timeout-based error for streams that take too long
 */
export function createTimeoutErrorChunk(timeoutMs: number): JsonRpcErrorChunk {
  return {
    type: 'error',
    code: -32001,
    message: `Stream operation timed out after ${timeoutMs}ms`,
    data: { timeout: timeoutMs, timestamp: new Date().toISOString() },
  };
}

/**
 * Wraps a stream with timeout protection, emitting a timeout error if exceeded
 */
export async function* withStreamTimeout<T>(stream: AsyncIterable<T>, timeoutMs: number): AsyncIterable<T | JsonRpcErrorChunk> {
  const iterator = stream[Symbol.asyncIterator]();
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    while (true) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Stream timeout')), timeoutMs);
      });

      try {
        const result = await Promise.race([iterator.next(), timeoutPromise]);

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        if (result.done) {
          break;
        }

        yield result.value;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        if ((error as Error).message === 'Stream timeout') {
          yield createTimeoutErrorChunk(timeoutMs);
        } else {
          yield createStreamErrorChunk(error);
        }
        break;
      }
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
