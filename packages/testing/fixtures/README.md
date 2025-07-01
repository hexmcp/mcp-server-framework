# Test Fixtures

This directory contains JSON-based test fixtures for validating MCP protocol compliance.

## Directory Structure

- `basic/` - Core protocol scenarios (handshake, ping, basic errors)
- `auth/` - Authentication and authorization scenarios  
- `lifecycle/` - Lifecycle state management scenarios
- `streaming/` - Streaming response scenarios
- `registries/` - Registry integration scenarios (prompts, tools, resources)
- `errors/` - Comprehensive error handling scenarios
- `performance/` - Performance and edge case scenarios

## Fixture Format

Each fixture is a JSON file with the following structure:

```json
{
  "name": "descriptive-fixture-name",
  "description": "Human-readable description of what this fixture tests",
  "category": "basic|auth|lifecycle|streaming|registries|errors|performance",
  "input": {
    "jsonrpc": "2.0",
    "id": "test-id",
    "method": "method/name",
    "params": {}
  },
  "expected": {
    "type": "success|error|stream",
    "response": {
      "jsonrpc": "2.0",
      "id": "test-id",
      "result": {}
    }
  },
  "metadata": {
    "requiresAuth": false,
    "lifecycleState": "ready",
    "timeout": 5000
  }
}
```

## Naming Conventions

- Use kebab-case for file names
- Include category prefix: `basic-handshake.json`, `auth-invalid-token.json`
- Be descriptive: `streaming-progress-notification.json`
