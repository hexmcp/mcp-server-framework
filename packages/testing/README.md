# @hexmcp/testing

Test Fixture Coverage system for the MCP Server Framework with JSON-based fixtures and Jest integration.

## Overview

This package provides a comprehensive testing framework for MCP (Model Context Protocol) servers using JSON-based test fixtures. It includes a test harness engine that uses in-process codec/dispatcher stacks without mock servers for comprehensive MCP protocol validation.

## Directory Structure

```
packages/testing/
├── fixtures/                    # JSON test fixtures
│   ├── basic/                  # Basic protocol tests
│   │   ├── valid-tool-call.json
│   │   └── invalid-params.json
│   └── prompts/               # Prompt-related tests
│       └── streaming-prompt.json
├── src/                       # Source code
│   ├── run-fixtures.ts        # Main fixture test runner entry point
│   ├── runner.ts              # Core logic to execute fixtures as Jest test cases
│   ├── types.ts               # TypeScript definitions for fixture schema
│   └── index.ts               # Package exports
├── test/                      # Meta-tests
│   └── runner.test.ts         # Tests to verify runner correctness
├── package.json               # Package configuration with Jest setup
├── tsconfig.json             # TypeScript configuration
└── jest.config.ts            # Jest configuration
```

## Features

- **JSON-RPC 2.0 Fixtures**: Test cases defined as complete request/response pairs in JSON files
- **Protocol Compliance**: Validates JSON-RPC 2.0 specification adherence
- **Streaming Support**: Tests chunked responses for streaming prompts and large outputs
- **Error Handling**: Comprehensive error scenario testing with proper status codes
- **Fixture Factories**: Reusable functions for generating spec-compliant test data
- **Golden Snapshot Testing**: Uses Node.js built-in `util.isDeepStrictEqual` for reliable comparisons
- **Jest Integration**: Seamless integration with Jest testing framework
- **In-process Testing**: Uses codec/dispatcher stacks without external mock servers
- **CI Integration**: Supports `pnpm test-fixtures` command for CI pipelines
- **Dynamic Discovery**: Automatically finds and loads all fixture files
- **80%+ Coverage**: Targets high test coverage for production readiness

## Fixture Format

Fixtures follow the new comprehensive format with JSON-RPC 2.0 compliance:

```json
{
  "name": "valid-tool-call",
  "input": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "echo", "arguments": { "message": "test" } }
  },
  "expected": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": { "content": [{ "type": "text", "text": "test" }] }
  }
}
```

For streaming responses:
```json
{
  "name": "streaming-prompt",
  "input": { "jsonrpc": "2.0", "id": 3, "method": "prompts/get", "params": {...} },
  "expected": [
    { "type": "text", "content": "First chunk" },
    { "type": "text", "content": "Second chunk" }
  ]
}
```

## Usage

### Running Fixtures

```typescript
import { runFixtures, FixtureRunner, runAllFixtures } from '@hexmcp/testing';

// Run all fixtures in a directory
await runFixtures('./fixtures/basic');

// Get detailed results for all fixtures
const results = await runAllFixtures('./fixtures');
console.log(`${results.filter(r => r.success).length} fixtures passed`);

// Use the runner directly for more control
const runner = new FixtureRunner({
  timeout: 5000,
  verbose: true,
  failFast: false
});
await runner.loadFixtures('./fixtures');
const results = await runner.executeAll();
```

### Creating Fixtures with Factories

```typescript
import {
  createToolRequest,
  createPromptRequest,
  createSuccessResponse,
  createErrorResponse,
  createLifecycleError,
  createStreamingChunks,
  createFixture,
  ErrorCodes
} from '@hexmcp/testing';

// Create a tool call fixture
const echoFixture = createFixture(
  'echo-success',
  createToolRequest('echo', { message: 'Hello!' }),
  createSuccessResponse(1, { content: [{ type: 'text', text: 'Hello!' }] })
);

// Create an error fixture
const errorFixture = createFixture(
  'invalid-params',
  createToolRequest('echo', {}),
  createErrorResponse(1, ErrorCodes.INVALID_PARAMS, 'Missing required parameter: message')
);

// Create a streaming fixture
const streamingFixture = createFixture(
  'streaming-response',
  createPromptRequest('generate', { topic: 'AI' }),
  createStreamingChunks('AI is', ' a powerful', ' technology.')
);

// Create a lifecycle error fixture
const lifecycleFixture = createFixture(
  'server-not-ready',
  createToolRequest('echo', { message: 'test' }),
  createLifecycleError(1, 'tools/call')
);
```

### Snapshot Testing

```typescript
import {
  saveSnapshot,
  loadSnapshot,
  expectMatchesSnapshot,
  configureSnapshots
} from '@hexmcp/testing';

// Configure snapshot behavior
configureSnapshots({
  snapshotsDir: '__snapshots__',
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  logger: (message) => console.warn(message) // Optional logging
});

// Save a snapshot for later comparison
const responseData = {
  jsonrpc: '2.0',
  id: 1,
  result: { content: [{ type: 'text', text: 'Hello!' }] }
};
await saveSnapshot('tool-response', responseData);

// Load and manually compare
const expected = await loadSnapshot('tool-response');
expect(actualResponse).toEqual(expected);

// Or use the Jest-aware utility
await expectMatchesSnapshot('tool-response', actualResponse);

// Streaming response snapshots
const streamingChunks = [
  { type: 'text', content: 'First chunk' },
  { type: 'text', content: 'Second chunk' },
  { type: 'event', name: 'completion', data: { finished: true } }
];
await expectMatchesSnapshot('streaming-response', streamingChunks);
```

### Advanced Streaming Handler Testing

```typescript
import {
  collectStream,
  collectStreamWithMetadata,
  expectStreamShape,
  testStreamedFixture,
  createMockStream,
  createTextStreamHandler,
  createEventStreamHandler,
  type HandlerContext,
  type StreamShape
} from '@hexmcp/testing';

// Test streaming handlers that return AsyncIterable<T>
const streamingHandler = async function* (input: { topic: string }, ctx: HandlerContext) {
  yield { type: 'text', content: `Analyzing ${input.topic}...` };
  yield { type: 'text', content: ' Results: Complete.' };
  yield { type: 'event', name: 'completion', data: { wordCount: 3 } };
};

// Collect all chunks from a stream
const chunks = await collectStream(streamingHandler({ topic: 'AI' }, mockContext));
expect(chunks).toHaveLength(3);

// Validate stream shape without snapshots
await expectStreamShape(streamingHandler({ topic: 'AI' }, mockContext), {
  count: 3,
  predicate: (chunk, index) => {
    if (index === 2) return chunk.type === 'event';
    return chunk.type === 'text';
  }
});

// Test with snapshot comparison
await testStreamedFixture(
  'ai-analysis',
  streamingHandler,
  { topic: 'AI' },
  mockContext
);

// Get detailed execution metadata
const result = await collectStreamWithMetadata(streamingHandler({ topic: 'AI' }, mockContext));
console.log(`Execution time: ${result.executionTime}ms`);
console.log(`Completed: ${result.completed}`);

// Create mock streams for testing
const mockStream = createMockStream(['chunk1', 'chunk2'], 10); // 10ms delay
const textHandler = createTextStreamHandler(['Hello', 'World'], 5);
const eventHandler = createEventStreamHandler([
  { name: 'start' },
  { name: 'complete', data: { success: true } }
]);
```

### Golden Fixture Testing

```typescript
import {
  runFixtureWithSnapshotUpdate,
  expectMatchesOrUpdateSnapshot,
  updateAllFixtureSnapshots
} from '@hexmcp/testing';

// Enable golden fixture mode with environment variable
// UPDATE_SNAPSHOTS=true pnpm test

// Run a single fixture with snapshot update capability
await runFixtureWithSnapshotUpdate('./fixtures/echo-tool.json');

// Compare or update individual snapshots
const actualResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: { content: [{ type: 'text', text: 'Hello!' }] }
};
await expectMatchesOrUpdateSnapshot('echo-response', actualResponse);

// Batch update all fixtures (use with caution!)
await updateAllFixtureSnapshots('./fixtures');

// Conditional updating based on environment
if (process.env.UPDATE_SNAPSHOTS === 'true' && process.env.NODE_ENV === 'development') {
  await runFixtureWithSnapshotUpdate('./fixtures/new-feature.json');
}
```

#### Golden Fixture Workflow

1. **Write New Tests**: Set `UPDATE_SNAPSHOTS=true` to capture actual output
2. **Review Changes**: Use `git diff __snapshots__/` to review updates
3. **Validate Output**: Ensure captured responses are correct and expected
4. **Commit Snapshots**: Add snapshot files to version control
5. **Normal Testing**: Run tests without the flag to validate against snapshots

### Streaming Error Fixtures

```typescript
import {
  wrapStreamingOutput,
  createPartiallyFailingStreamHandler,
  validateStreamErrorPattern,
  createStreamingErrorFixture,
  isErrorChunk,
  separateStreamErrors
} from '@hexmcp/testing';

// Wrap streams to convert errors to structured chunks
const safeStream = wrapStreamingOutput(unreliableStream(), {
  includeStackTrace: true,
  maxChunks: 100
});

// Create handlers that fail mid-stream for testing
const handler = createPartiallyFailingStreamHandler(
  [
    { type: 'text', content: 'Processing...' },
    { type: 'text', content: 'Almost done...' }
  ],
  new Error('Database connection failed')
);

// Validate streaming error patterns
await validateStreamErrorPattern(stream, {
  successCount: 2,
  errorCode: -32000,
  errorMessage: /Database connection failed/,
  endsWithError: true
});

// Create fixtures for streaming errors
const fixture = createStreamingErrorFixture(
  'partial-failure-test',
  'tools/call',
  { name: 'process', arguments: { data: 'test' } },
  [
    { type: 'text', content: 'Starting...' },
    { type: 'event', name: 'progress', data: { percent: 50 } }
  ],
  { type: 'error', code: -32000, message: 'Process failed' }
);

// Separate success and error chunks for analysis
const { successChunks, errorChunks } = await separateStreamErrors(stream);
```

## Scripts

- `pnpm build` - Build the package
- `pnpm test` - Run all tests
- `pnpm test-fixtures` - Run fixture tests specifically
- `pnpm typecheck` - Type check the code

## Available Factories

The package includes comprehensive fixture factories for creating spec-compliant test data:

### Request Factories
- `createToolRequest(name, input, id?)` - Tool execution requests
- `createPromptRequest(name, input, id?)` - Prompt execution requests
- `createResourceRequest(uri, id?)` - Resource read requests
- `createToolsListRequest(id?)` - Tools enumeration requests
- `createPromptsListRequest(id?)` - Prompts enumeration requests
- `createResourcesListRequest(id?)` - Resources enumeration requests

### Response Factories
- `createSuccessResponse(id, result)` - Successful JSON-RPC responses
- `createErrorResponse(id, code, message, data?)` - Error responses
- `createLifecycleError(id, operation, state?)` - MCP lifecycle errors

### Streaming Factories
- `createStreamingChunks(...texts)` - Text streaming chunks
- `createEventChunk(name, data?)` - Event-type chunks
- `createImageChunk(url, alt?)` - Image-type chunks

### Streaming Handler Testing
- `collectStream(iterable, timeout?)` - Collect all chunks from AsyncIterable
- `collectStreamWithMetadata(iterable, timeout?)` - Collect with execution metadata
- `expectStreamShape(iterable, shape, timeout?)` - Validate stream structure
- `testStreamedFixture(name, handler, input, ctx, timeout?)` - Snapshot-based stream testing
- `createMockStream(items, delay?, shouldError?)` - Create mock async iterables
- `createTextStreamHandler(texts, delay?)` - Create text streaming handlers
- `createEventStreamHandler(events, delay?)` - Create event streaming handlers

### Fixture Factory
- `createFixture(name, input, expected)` - Complete fixture objects

### Snapshot Utilities
- `saveSnapshot(name, data, baseDir?)` - Save JSON snapshots to disk
- `loadSnapshot(name, baseDir?)` - Load previously saved snapshots
- `expectMatchesSnapshot(name, actual, baseDir?)` - Jest-aware snapshot comparison
- `configureSnapshots(config)` - Global snapshot configuration

### Golden Fixture Testing
- `runFixtureWithSnapshotUpdate(fixturePath, snapshotName?)` - Run fixture with snapshot update
- `expectMatchesOrUpdateSnapshot(name, actual)` - Compare or update snapshots based on flag
- `updateAllFixtureSnapshots(fixtureDir, snapshotDir?)` - Batch update all fixture snapshots

### Streaming Error Testing
- `wrapStreamingOutput(stream, options?)` - Convert stream errors to structured chunks
- `createPartiallyFailingStreamHandler(successChunks, error, options?)` - Create handlers that fail mid-stream
- `createRandomlyFailingStreamHandler(chunks, failureRate?, options?)` - Create randomly failing handlers
- `validateStreamErrorPattern(stream, pattern)` - Validate streaming error patterns
- `separateStreamErrors(stream)` - Separate success and error chunks
- `isErrorChunk(chunk)` - Type guard for error chunks
- `withStreamTimeout(stream, timeoutMs)` - Add timeout protection to streams

### Error Codes
- `ErrorCodes` - Standard JSON-RPC and MCP-specific error codes

## Status

✅ **Production Ready** - Complete test fixture coverage system with:
- Dynamic fixture discovery and loading
- Full MCP protocol execution stack
- Comprehensive fixture factories
- Golden snapshot testing utilities
- Golden fixture flag support (`UPDATE_SNAPSHOTS=true`)
- Advanced streaming handler testing
- Streaming error fixtures with structured error chunks
- Transport-agnostic AsyncIterable testing
- Jest integration and CI/CD support
- 107/107 tests passing with comprehensive coverage
