import {
  createErrorResponse,
  createEventChunk,
  createFixture,
  createLifecycleError,
  createPromptRequest,
  createStreamingChunks,
  createSuccessResponse,
  createToolRequest,
  ErrorCodes,
} from '../src/factories';

// Example 1: Creating a simple tool call fixture
const echoFixture = createFixture(
  'echo-tool-success',
  createToolRequest('echo', { message: 'Hello, World!' }),
  createSuccessResponse(1, {
    content: [{ type: 'text', text: 'Hello, World!' }],
  })
);

// Example 2: Creating an error fixture
const invalidParamsFixture = createFixture(
  'invalid-tool-params',
  createToolRequest('echo', {}), // Missing required 'message' parameter
  createErrorResponse(1, ErrorCodes.INVALID_PARAMS, 'Missing required parameter: message', {
    parameter: 'message',
    received: {},
  })
);

// Example 3: Creating a lifecycle error fixture (server not ready)
const lifecycleErrorFixture = createFixture(
  'tool-call-not-ready',
  createToolRequest('echo', { message: 'test' }),
  createLifecycleError(1, 'tools/call')
);

// Example 4: Creating a streaming prompt fixture
const streamingPromptFixture = createFixture(
  'streaming-prompt-response',
  createPromptRequest('generate-story', { topic: 'space exploration' }),
  [
    ...createStreamingChunks('Once upon a time, ', 'in a galaxy far away, ', 'brave explorers ventured into the unknown.'),
    createEventChunk('completion', { finished: true, wordCount: 12 }),
  ]
);

// Example 5: Creating a method not found fixture
const methodNotFoundFixture = createFixture(
  'unknown-method',
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'unknown/method',
    params: {},
  },
  createErrorResponse(1, ErrorCodes.METHOD_NOT_FOUND, "Method 'unknown/method' not found")
);

// Example 6: Batch fixture creation for comprehensive testing
const createEchoTestSuite = () => {
  const baseInput = { message: 'test' };

  return [
    // Success case
    createFixture(
      'echo-success',
      createToolRequest('echo', baseInput),
      createSuccessResponse(1, { content: [{ type: 'text', text: 'test' }] })
    ),

    // Empty message case
    createFixture(
      'echo-empty-message',
      createToolRequest('echo', { message: '' }),
      createSuccessResponse(1, { content: [{ type: 'text', text: '' }] })
    ),

    // Missing arguments case
    createFixture(
      'echo-missing-args',
      createToolRequest('echo', {}),
      createErrorResponse(1, ErrorCodes.INVALID_PARAMS, 'Missing required parameter: message')
    ),

    // Server not ready case
    createFixture('echo-not-ready', createToolRequest('echo', baseInput), createLifecycleError(1, 'tools/call')),
  ];
};

// Example 7: Complex streaming response with mixed chunk types
const complexStreamingFixture = createFixture(
  'complex-streaming-response',
  createPromptRequest('analyze-image', { imageUrl: 'https://example.com/image.jpg' }),
  [
    createEventChunk('analysis-start', { timestamp: Date.now() }),
    ...createStreamingChunks('Analyzing image... ', 'Found objects: '),
    createEventChunk('objects-detected', { count: 3, objects: ['car', 'tree', 'building'] }),
    ...createStreamingChunks('The image shows a urban scene with '),
    createEventChunk('confidence-score', { score: 0.95 }),
    ...createStreamingChunks('high confidence in the detection results.'),
    createEventChunk('analysis-complete', { duration: 1250 }),
  ]
);

// Export examples for use in tests or documentation
export {
  echoFixture,
  invalidParamsFixture,
  lifecycleErrorFixture,
  streamingPromptFixture,
  methodNotFoundFixture,
  createEchoTestSuite,
  complexStreamingFixture,
};
