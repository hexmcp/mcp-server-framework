import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { configureSnapshots } from '../src/snapshot';
import {
  collectStream,
  collectStreamWithMetadata,
  createEventStreamHandler,
  createMockStream,
  createTextStreamHandler,
  expectStreamShape,
  type HandlerContext,
  type StreamShape,
  testStreamedFixture,
} from '../src/streaming';

function createMockContext(id: string): HandlerContext {
  return {
    request: { jsonrpc: '2.0', id, method: 'test' },
    send: async () => {
      // Mock send function for testing
    },
    transport: { name: 'test' },
    state: {},
  };
}

describe('Streaming Handler Testing', () => {
  const testSnapshotsDir = join(__dirname, 'test-streaming-snapshots');

  beforeEach(async () => {
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });
  });

  describe('collectStream', () => {
    it('should collect all chunks from async iterable', async () => {
      const mockData = ['chunk1', 'chunk2', 'chunk3'];
      const stream = createMockStream(mockData);

      const result = await collectStream(stream);

      expect(result).toEqual(mockData);
    });

    it('should handle empty streams', async () => {
      const stream = createMockStream([]);

      const result = await collectStream(stream);

      expect(result).toEqual([]);
    });

    it('should timeout on slow streams', async () => {
      const stream = createMockStream(['chunk1'], 200);

      await expect(collectStream(stream, 50)).rejects.toThrow('timed out after 50ms');
    });

    it('should handle stream errors', async () => {
      const stream = createMockStream(['chunk1'], 0, true);

      await expect(collectStream(stream)).rejects.toThrow('Mock stream error');
    });
  });

  describe('collectStreamWithMetadata', () => {
    it('should collect chunks with execution metadata', async () => {
      const mockData = ['chunk1', 'chunk2'];
      const stream = createMockStream(mockData, 10);

      const result = await collectStreamWithMetadata(stream);

      expect(result.chunks).toEqual(mockData);
      expect(result.completed).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle errors with partial completion', async () => {
      const stream = createMockStream(['chunk1', 'chunk2'], 0, true);

      const result = await collectStreamWithMetadata(stream);

      expect(result.chunks).toEqual(['chunk1', 'chunk2']);
      expect(result.completed).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Mock stream error');
    });

    it('should handle timeout with metadata', async () => {
      const stream = createMockStream(['chunk1'], 200);

      const result = await collectStreamWithMetadata(stream, 50);

      expect(result.chunks).toEqual([]);
      expect(result.completed).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });
  });

  describe('expectStreamShape', () => {
    it('should validate correct chunk count', async () => {
      const stream = createMockStream(['a', 'b', 'c']);
      const shape: StreamShape<string> = { count: 3 };

      await expectStreamShape(stream, shape);
    });

    it('should fail on incorrect chunk count', async () => {
      const stream = createMockStream(['a', 'b']);
      const shape: StreamShape<string> = { count: 3 };

      await expect(expectStreamShape(stream, shape)).rejects.toThrow('Expected 3 chunks, but received 2');
    });

    it('should validate partial match', async () => {
      const chunks = [
        { type: 'text', content: 'hello' },
        { type: 'text', content: 'world' },
      ];
      const stream = createMockStream(chunks);
      const shape: StreamShape<(typeof chunks)[0]> = {
        count: 2,
        match: { type: 'text' },
      };

      await expectStreamShape(stream, shape);
    });

    it('should fail on partial match mismatch', async () => {
      const chunks = [
        { type: 'text', content: 'hello' },
        { type: 'event', content: 'world' },
      ];
      const stream = createMockStream(chunks);
      const shape: StreamShape<(typeof chunks)[0]> = {
        count: 2,
        match: { type: 'text' },
      };

      await expect(expectStreamShape(stream, shape)).rejects.toThrow("property 'type' mismatch");
    });

    it('should validate custom predicate', async () => {
      const chunks = [1, 2, 3, 4];
      const stream = createMockStream(chunks);
      const shape: StreamShape<number> = {
        count: 4,
        predicate: (chunk, index) => chunk === index + 1,
      };

      await expectStreamShape(stream, shape);
    });

    it('should fail on custom predicate failure', async () => {
      const chunks = [1, 3, 3, 4];
      const stream = createMockStream(chunks);
      const shape: StreamShape<number> = {
        count: 4,
        predicate: (chunk, index) => chunk === index + 1,
      };

      await expect(expectStreamShape(stream, shape)).rejects.toThrow('failed custom predicate validation');
    });
  });

  describe('testStreamedFixture', () => {
    it('should test streaming handler with snapshot comparison', async () => {
      const handler = createTextStreamHandler(['Hello', ' ', 'World!']);
      const ctx = createMockContext('test-1');

      // Configure snapshots to use our test directory
      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await testStreamedFixture('text-greeting', handler, {}, ctx);

      const snapshotPath = join(testSnapshotsDir, 'streaming-text-greeting.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle streaming handler errors', async () => {
      const handler = async function* () {
        yield { type: 'text', content: 'start' };
        throw new Error('Handler error');
      };
      const ctx = createMockContext('test-2');

      await expect(testStreamedFixture('error-handler', handler, {}, ctx)).rejects.toThrow('Handler error');
    });
  });

  describe('createTextStreamHandler', () => {
    it('should create handler that emits text chunks', async () => {
      const texts = ['Hello', 'World'];
      const handler = createTextStreamHandler(texts);
      const ctx = createMockContext('test-3');

      const stream = handler({}, ctx);
      const chunks = await collectStream(stream);

      expect(chunks).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: 'World' },
      ]);
    });

    it('should respect delay between chunks', async () => {
      const texts = ['A', 'B'];
      const handler = createTextStreamHandler(texts, 50);
      const ctx = createMockContext('test-4');

      const startTime = Date.now();
      const stream = handler({}, ctx);
      await collectStream(stream);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('createEventStreamHandler', () => {
    it('should create handler that emits event chunks', async () => {
      const events = [{ name: 'start', data: { timestamp: 123 } }, { name: 'progress', data: { percent: 50 } }, { name: 'complete' }];
      const handler = createEventStreamHandler<{ timestamp?: number; percent?: number }>(events);
      const ctx = createMockContext('test-5');

      const stream = handler({}, ctx);
      const chunks = await collectStream(stream);

      expect(chunks).toEqual([
        { type: 'event', name: 'start', data: { timestamp: 123 } },
        { type: 'event', name: 'progress', data: { percent: 50 } },
        { type: 'event', name: 'complete' },
      ]);
    });
  });

  describe('createMockStream', () => {
    it('should create async iterable from array', async () => {
      const items = [1, 2, 3];
      const stream = createMockStream(items);

      const result = await collectStream(stream);

      expect(result).toEqual(items);
    });

    it('should emit items with delay', async () => {
      const items = ['a', 'b'];
      const stream = createMockStream(items, 25);

      const startTime = Date.now();
      await collectStream(stream);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(25);
    });

    it('should throw error when configured', async () => {
      const items = ['item'];
      const stream = createMockStream(items, 0, true);

      await expect(collectStream(stream)).rejects.toThrow('Mock stream error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex streaming workflow', async () => {
      const handler = async function* (input: { topic: string }, _ctx: HandlerContext) {
        yield { type: 'event', name: 'start', data: { topic: input.topic } };
        yield { type: 'text', content: `Analyzing ${input.topic}...` };
        yield { type: 'text', content: ' Results: ' };
        yield { type: 'text', content: 'Analysis complete.' };
        yield { type: 'event', name: 'complete', data: { duration: 100 } };
      };

      const ctx = createMockContext('integration-1');
      const stream = handler({ topic: 'AI' }, ctx);

      await expectStreamShape(stream, {
        count: 5,
        predicate: (chunk, index) => {
          if (index === 0) {
            return chunk.type === 'event' && chunk.name === 'start';
          }
          if (index === 4) {
            return chunk.type === 'event' && chunk.name === 'complete';
          }
          return chunk.type === 'text';
        },
      });
    });

    it('should handle streaming with error recovery', async () => {
      const handler = async function* () {
        yield { type: 'text', content: 'Starting...' };
        try {
          throw new Error('Simulated error');
        } catch {
          yield { type: 'event', name: 'error', data: { recovered: true } };
          yield { type: 'text', content: 'Recovered successfully' };
        }
      };

      const stream = handler();
      const chunks = await collectStream(stream);

      expect(chunks).toHaveLength(3);
      expect(chunks[1]?.type).toBe('event');
      expect(chunks[1]?.name).toBe('error');
      expect(chunks[2]?.type).toBe('text');
    });
  });
});
