import {
  collectStream,
  collectStreamWithMetadata,
  createEventStreamHandler,
  createMockStream,
  createTextStreamHandler,
  expectStreamShape,
  type HandlerContext,
  testStreamedFixture,
} from '../src/streaming';

// Helper function to create mock context
function createMockContext(id: string): HandlerContext {
  return {
    request: { jsonrpc: '2.0', id, method: 'test' },
    send: async () => {
      // No-op for testing
    },
    transport: { name: 'test' },
    state: {},
  };
}

// Example 1: Testing a streaming prompt handler
async function exampleStreamingPromptTest() {
  // Create a mock streaming prompt handler
  const streamingPromptHandler = async function* (input: { topic: string }, _ctx: HandlerContext) {
    yield { type: 'text', content: `Generating content about ${input.topic}...` };
    yield { type: 'text', content: '\n\n' };
    yield { type: 'text', content: 'Here is the generated content:' };
    yield { type: 'text', content: '\n' };
    yield { type: 'text', content: `${input.topic} is a fascinating subject.` };
    yield { type: 'event', name: 'completion', data: { wordCount: 8 } };
  };

  const ctx = createMockContext('prompt-test-1');

  // Test using snapshot comparison
  await testStreamedFixture('topic-generation', streamingPromptHandler, { topic: 'Artificial Intelligence' }, ctx);
}

// Example 2: Testing streaming tool with shape validation
async function exampleStreamingToolTest() {
  // Create a mock streaming tool handler
  const imageGenerationTool = async function* (input: { prompt: string; steps: number }, _ctx: HandlerContext) {
    yield { type: 'event', name: 'start', data: { prompt: input.prompt } };

    for (let i = 1; i <= input.steps; i++) {
      yield {
        type: 'event',
        name: 'progress',
        data: { step: i, total: input.steps, percent: (i / input.steps) * 100 },
      };

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    yield {
      type: 'event',
      name: 'complete',
      data: { imageUrl: 'https://example.com/generated-image.png' },
    };
  };

  const ctx = createMockContext('tool-test-1');
  const stream = imageGenerationTool({ prompt: 'sunset', steps: 3 }, ctx);

  // Validate stream shape without snapshots
  await expectStreamShape(stream, {
    count: 5, // start + 3 progress + complete
    predicate: (chunk, index) => {
      if (index === 0) {
        return chunk.name === 'start';
      }
      if (index >= 1 && index <= 3) {
        return chunk.name === 'progress';
      }
      if (index === 4) {
        return chunk.name === 'complete';
      }
      return false;
    },
  });
}

// Example 3: Collecting and analyzing stream data
async function exampleStreamAnalysis() {
  const dataProcessingHandler = async function* () {
    const data = [
      { id: 1, value: 'alpha' },
      { id: 2, value: 'beta' },
      { id: 3, value: 'gamma' },
    ];

    for (const item of data) {
      yield { type: 'data', item };
      yield { type: 'event', name: 'processed', data: { id: item.id } };
    }
  };

  // Collect all chunks for analysis
  const chunks = await collectStream(dataProcessingHandler());

  // Analyze the collected data
  const dataChunks = chunks.filter((chunk) => chunk.type === 'data');
  const eventChunks = chunks.filter((chunk) => chunk.type === 'event');

  // In a real scenario, you might log this for debugging
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating logging
  console.log(`Processed ${dataChunks.length} data items`);
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating logging
  console.log(`Generated ${eventChunks.length} events`);

  // Verify alternating pattern
  for (let i = 0; i < chunks.length; i += 2) {
    if (chunks[i]?.type !== 'data' || chunks[i + 1]?.type !== 'event') {
      throw new Error(`Expected alternating data/event pattern at index ${i}`);
    }
  }
}

// Example 4: Testing error handling in streams
async function exampleStreamErrorHandling() {
  const faultyHandler = async function* () {
    yield { type: 'text', content: 'Starting process...' };
    yield { type: 'text', content: 'Processing data...' };

    // Simulate an error condition
    throw new Error('Processing failed');
  };

  // Test error handling with metadata collection
  const result = await collectStreamWithMetadata(faultyHandler());

  expect(result.chunks).toHaveLength(2);
  expect(result.completed).toBe(true); // Partial completion
  expect(result.error).toBeDefined();
  expect(result.error?.message).toBe('Processing failed');
  expect(result.executionTime).toBeGreaterThan(0);
}

// Example 5: Testing streaming with timeout scenarios
async function exampleStreamTimeout() {
  const slowHandler = async function* () {
    yield { type: 'text', content: 'Starting...' };

    // Simulate slow processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    yield { type: 'text', content: 'This will timeout' };
  };

  try {
    // This should timeout after 500ms
    await collectStream(slowHandler(), 500);
    throw new Error('Expected timeout');
  } catch (error) {
    expect((error as Error).message).toContain('timed out after 500ms');
  }
}

// Example 6: Using built-in stream creators
async function exampleBuiltInCreators() {
  // Create a text streaming handler
  const textHandler = createTextStreamHandler(['Hello', ' ', 'streaming', ' ', 'world!'], 10); // 10ms delay between chunks

  const ctx = createMockContext('text-example');
  const textStream = textHandler({}, ctx);
  const textChunks = await collectStream(textStream);

  expect(textChunks).toHaveLength(5);
  expect(textChunks.every((chunk) => chunk.type === 'text')).toBe(true);

  // Create an event streaming handler
  const eventHandler = createEventStreamHandler([
    { name: 'start' },
    { name: 'progress', data: { percent: 50 } },
    { name: 'progress', data: { percent: 100 } },
    { name: 'complete', data: { result: 'success' } },
  ]);

  const eventStream = eventHandler({}, ctx);
  const eventChunks = await collectStream(eventStream);

  expect(eventChunks).toHaveLength(4);
  expect(eventChunks.every((chunk) => chunk.type === 'event')).toBe(true);
}

// Example 7: Complex streaming workflow testing
async function exampleComplexWorkflow() {
  const workflowHandler = async function* (input: { task: string }, _ctx: HandlerContext) {
    // Phase 1: Initialization
    yield { type: 'event', name: 'init', data: { task: input.task } };
    yield { type: 'text', content: `Starting task: ${input.task}` };

    // Phase 2: Processing with progress updates
    const steps = ['analyze', 'process', 'validate', 'finalize'];
    for (let i = 0; i < steps.length; i++) {
      yield {
        type: 'event',
        name: 'progress',
        data: { step: steps[i], progress: (i + 1) / steps.length },
      };
      yield { type: 'text', content: `${steps[i]}...` };
    }

    // Phase 3: Completion
    yield { type: 'text', content: 'Task completed successfully!' };
    yield {
      type: 'event',
      name: 'complete',
      data: { task: input.task, duration: 1000 },
    };
  };

  const ctx = createMockContext('workflow-1');

  // Test the complete workflow
  await testStreamedFixture('complex-workflow', workflowHandler, { task: 'data-migration' }, ctx);

  // Also validate the structure
  const stream = workflowHandler({ task: 'data-migration' }, ctx);
  await expectStreamShape(stream, {
    count: 10, // 1 init + 4 progress + 4 text + 1 completion text + 1 complete event
    predicate: (chunk, index) => {
      // Validate the expected pattern
      if (index === 0) {
        return chunk.type === 'event' && chunk.name === 'init';
      }
      if (index === 9) {
        return chunk.type === 'event' && chunk.name === 'complete';
      }
      return chunk.type === 'event' || chunk.type === 'text';
    },
  });
}

// Example 8: Mock stream for unit testing
async function exampleMockStreamTesting() {
  // Create a mock stream for testing
  const mockData = [
    { id: 1, status: 'pending' },
    { id: 1, status: 'processing' },
    { id: 1, status: 'complete' },
  ];

  const mockStream = createMockStream(mockData, 5); // 5ms delay between items

  // Test collection
  const result = await collectStreamWithMetadata(mockStream);

  expect(result.chunks).toEqual(mockData);
  expect(result.completed).toBe(true);
  expect(result.executionTime).toBeGreaterThanOrEqual(10); // At least 2 * 5ms delay
}

// Export examples for documentation and testing
export {
  exampleStreamingPromptTest,
  exampleStreamingToolTest,
  exampleStreamAnalysis,
  exampleStreamErrorHandling,
  exampleStreamTimeout,
  exampleBuiltInCreators,
  exampleComplexWorkflow,
  exampleMockStreamTesting,
};
