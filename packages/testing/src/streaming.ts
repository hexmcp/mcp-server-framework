import type { RequestContext } from '@hexmcp/core';
import { expectMatchesSnapshot } from './snapshot';

/**
 * Context interface for streaming handler testing.
 */
export interface HandlerContext extends RequestContext {
  /** Additional test-specific context properties */
  testMode?: boolean;
  mockData?: Record<string, unknown>;
}

/**
 * Shape validation configuration for streaming assertions.
 */
export interface StreamShape<T> {
  /** Expected number of chunks */
  count: number;
  /** Optional partial match for chunk content */
  match?: Partial<T>;
  /** Optional predicate function for custom validation */
  predicate?: (chunk: T, index: number) => boolean;
}

/**
 * Result of stream collection with metadata.
 */
export interface StreamResult<T> {
  /** All collected chunks */
  chunks: T[];
  /** Total execution time in milliseconds */
  executionTime: number;
  /** Whether the stream completed successfully */
  completed: boolean;
  /** Any error that occurred during streaming */
  error?: Error;
}

/**
 * Invoke a prompt or tool handler that streams output
 * and collect all chunks into an array.
 *
 * @param iterable - The async iterable to collect from
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns Promise resolving to array of all emitted chunks
 */
export async function collectStream<T>(iterable: AsyncIterable<T>, timeout = 5000): Promise<T[]> {
  const chunks: T[] = [];
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Stream collection timed out after ${timeout}ms`)), timeout);
  });

  try {
    await Promise.race([
      (async () => {
        for await (const chunk of iterable) {
          chunks.push(chunk);
        }
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      throw error;
    }
    // Re-throw other errors but still return collected chunks
    throw error;
  } finally {
    // Always clear the timeout to prevent hanging handles
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  return chunks;
}

/**
 * Collect stream with detailed metadata about the execution.
 *
 * @param iterable - The async iterable to collect from
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns Promise resolving to detailed stream result
 */
export async function collectStreamWithMetadata<T>(iterable: AsyncIterable<T>, timeout = 5000): Promise<StreamResult<T>> {
  const startTime = Date.now();
  const chunks: T[] = [];
  let completed = false;
  let error: Error | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Stream collection timed out after ${timeout}ms`)), timeout);
  });

  try {
    await Promise.race([
      (async () => {
        for await (const chunk of iterable) {
          chunks.push(chunk);
        }
        completed = true;
      })(),
      timeoutPromise,
    ]);
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    if (!error.message.includes('timed out')) {
      // For non-timeout errors, we still consider partial completion
      completed = chunks.length > 0;
    }
  } finally {
    // Always clear the timeout to prevent hanging handles
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  return {
    chunks,
    executionTime: Date.now() - startTime,
    completed,
    ...(error && { error }),
  };
}

/**
 * Run a test against a known streamed fixture and
 * validate the full chunk sequence using snapshot testing.
 *
 * @param name - Fixture name for snapshot comparison
 * @param handler - Handler function that returns AsyncIterable
 * @param input - Input to pass to the handler
 * @param ctx - Handler context
 * @param timeout - Optional timeout in milliseconds
 */
export async function testStreamedFixture<TInput, TOutput>(
  name: string,
  handler: (input: TInput, ctx: HandlerContext) => AsyncIterable<TOutput>,
  input: TInput,
  ctx: HandlerContext,
  timeout = 5000
): Promise<void> {
  const iterable = handler(input, ctx);
  const chunks = await collectStream(iterable, timeout);

  await expectMatchesSnapshot(`streaming-${name}`, chunks);
}

/**
 * Assert that a streaming handler emits an expected number
 * and type of chunks without using a golden snapshot.
 *
 * @param iterable - The async iterable to validate
 * @param shape - Expected shape configuration
 * @param timeout - Optional timeout in milliseconds
 */
export async function expectStreamShape<T>(iterable: AsyncIterable<T>, shape: StreamShape<T>, timeout = 5000): Promise<void> {
  const chunks = await collectStream(iterable, timeout);

  // Validate chunk count
  if (chunks.length !== shape.count) {
    throw new Error(`Expected ${shape.count} chunks, but received ${chunks.length}. ` + `Chunks: ${JSON.stringify(chunks, null, 2)}`);
  }

  // Validate partial match if provided
  if (shape.match) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      for (const [key, expectedValue] of Object.entries(shape.match)) {
        const actualValue = (chunk as Record<string, unknown>)[key];
        if (actualValue !== expectedValue) {
          throw new Error(
            `Chunk ${i} property '${key}' mismatch. ` +
              `Expected: ${JSON.stringify(expectedValue)}, ` +
              `Actual: ${JSON.stringify(actualValue)}`
          );
        }
      }
    }
  }

  // Validate custom predicate if provided
  if (shape.predicate) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk && !shape.predicate(chunk, i)) {
        throw new Error(`Chunk ${i} failed custom predicate validation. ` + `Chunk: ${JSON.stringify(chunk, null, 2)}`);
      }
    }
  }
}

/**
 * Create a mock async iterable for testing purposes.
 *
 * @param items - Items to emit
 * @param delay - Optional delay between emissions in milliseconds
 * @param shouldError - Whether to throw an error after emitting items
 */
export async function* createMockStream<T>(items: T[], delay = 0, shouldError = false): AsyncIterable<T> {
  for (let i = 0; i < items.length; i++) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const item = items[i];
    if (item !== undefined) {
      yield item;
    }
  }

  if (shouldError) {
    throw new Error('Mock stream error');
  }
}

/**
 * Utility to create a streaming handler that emits text chunks.
 *
 * @param texts - Array of text strings to emit
 * @param delay - Optional delay between chunks
 */
export function createTextStreamHandler(
  texts: string[],
  delay = 0
): (input: unknown, ctx: HandlerContext) => AsyncIterable<{ type: 'text'; content: string }> {
  return async function* (_input: unknown, _ctx: HandlerContext) {
    for (const text of texts) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      yield { type: 'text', content: text };
    }
  };
}

/**
 * Utility to create a streaming handler that emits events.
 *
 * @param events - Array of events to emit
 * @param delay - Optional delay between events
 */
export function createEventStreamHandler<T>(
  events: Array<{ name: string; data?: T }>,
  delay = 0
): (input: unknown, ctx: HandlerContext) => AsyncIterable<{ type: 'event'; name: string; data?: T }> {
  return async function* (_input: unknown, _ctx: HandlerContext) {
    for (const event of events) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      yield {
        type: 'event',
        name: event.name,
        ...(event.data !== undefined && { data: event.data }),
      };
    }
  };
}
