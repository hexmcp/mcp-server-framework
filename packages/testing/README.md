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

### Fixture Factory
- `createFixture(name, input, expected)` - Complete fixture objects

### Error Codes
- `ErrorCodes` - Standard JSON-RPC and MCP-specific error codes

## Status

✅ **Production Ready** - Complete test fixture coverage system with:
- Dynamic fixture discovery and loading
- Full MCP protocol execution stack
- Comprehensive fixture factories
- Jest integration and CI/CD support
- 38/38 tests passing with comprehensive coverage
