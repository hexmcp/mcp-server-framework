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

## Features (Planned)

- **JSON-RPC 2.0 Fixtures**: Test cases defined as complete request/response pairs in JSON files
- **Protocol Compliance**: Validates JSON-RPC 2.0 specification adherence
- **Streaming Support**: Tests chunked responses for streaming prompts and large outputs
- **Error Handling**: Comprehensive error scenario testing with proper status codes
- **Jest Integration**: Seamless integration with Jest testing framework
- **In-process Testing**: Uses codec/dispatcher stacks without external mock servers
- **CI Integration**: Supports `pnpm test-fixtures` command for CI pipelines
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

## Usage (Planned)

```typescript
import { runFixtures, FixtureRunner } from '@hexmcp/testing';
import type { Fixture } from '@hexmcp/testing';

// Run all fixtures in a directory
await runFixtures('./fixtures/basic');

// Use the runner directly
const runner = new FixtureRunner({
  timeout: 5000,
  verbose: true,
  tags: ['basic']
});
await runner.loadFixtures('./fixtures');
const results = await runner.executeAll();
```

## Scripts

- `pnpm build` - Build the package
- `pnpm test` - Run all tests
- `pnpm test-fixtures` - Run fixture tests specifically
- `pnpm typecheck` - Type check the code

## Status

🚧 **Under Development** - This package structure has been created but the actual fixture runner logic is not yet implemented. This is part of Step 1 of the Test Fixture Coverage system implementation.

## Next Steps

1. Implement the actual fixture runner logic in `runner.ts`
2. Add fixture loading from JSON files
3. Implement test execution with MCP protocol validation
4. Add streaming response support
5. Integrate with CI/CD pipeline
