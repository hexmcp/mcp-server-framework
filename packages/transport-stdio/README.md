# @hexmcp/transport-stdio

STDIO transport implementation for MCP Server Framework providing JSON-RPC 2.0 communication over stdin/stdout using NDJSON format.

## Features

- 🔌 **STDIO Communication**: JSON-RPC 2.0 over stdin/stdout using NDJSON protocol
- 📝 **NDJSON Protocol**: One JSON object per line for reliable message framing
- 🛡️ **Error Handling**: Proper JSON-RPC error responses for parse failures
- 🔄 **Lifecycle Management**: Graceful start/stop with cleanup
- 🚀 **High Performance**: Efficient readline-based message processing
- ✅ **Well Tested**: 80%+ test coverage with comprehensive edge cases
- 🔗 **Transport Integration**: Compatible with MCP transport registry system

## Installation

```bash
npm install @hexmcp/transport-stdio
```

## Quick Start

### Basic Usage

```typescript
import { StdioTransport } from '@hexmcp/transport-stdio';
import type { TransportDispatch } from '@hexmcp/transport';
import { createStderrLogger } from '@hexmcp/core';

const transport = new StdioTransport();

const dispatch: TransportDispatch = (message, respond, metadata) => {
  // Use stderr logger for stdio transport safety
  const logger = createStderrLogger();
  logger.info('Message received', {
    method: (message as any).method,
    id: (message as any).id,
    transport: 'stdio'
  });
  logger.debug('Transport metadata', { metadata });

  // Echo the method back as result
  respond({
    jsonrpc: "2.0",
    id: (message as any).id,
    result: { echo: (message as any).method }
  });
};

// Start the transport
await transport.start(dispatch);

// Transport will now process NDJSON messages from stdin
// and write responses to stdout

// Graceful shutdown
await transport.stop();
```

### Integration with Transport Registry

```typescript
import { StdioTransport } from '@hexmcp/transport-stdio';
// Note: Registry functions are internal APIs
// import { TransportRegistry, startAllTransports } from '@hexmcp/transport';

const transport = new StdioTransport();

// Future builder integration:
// builder.transport(transport)

// Current manual registration:
// const registry = new TransportRegistry();
// registry.registerTransport(transport);
// await startAllTransports(registry, dispatch);
```

## Protocol Details

### NDJSON Format

The transport uses NDJSON (Newline Delimited JSON) for message framing:

- Each message is a single line of JSON
- Lines are separated by newline characters (`\n`)
- No buffering between messages
- Immediate processing of complete lines

### Input Processing

```typescript
// Valid input examples:
{"jsonrpc":"2.0","id":1,"method":"ping"}
{"jsonrpc":"2.0","method":"notify","params":["hello"]}
{"jsonrpc":"2.0","id":"test","method":"getData","params":{"key":"value"}}

// Each line is processed independently
```

### Output Format

```typescript
// Success response:
{"jsonrpc":"2.0","id":1,"result":{"status":"ok"}}

// Error response:
{"jsonrpc":"2.0","id":1,"error":{"code":-32700,"message":"Parse error"}}

// Parse error (for invalid JSON):
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

## Error Handling

### Parse Errors

Invalid JSON input automatically generates JSON-RPC parse error responses:

```typescript
// Input: invalid json
// Output: {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}

// Input: {"incomplete":
// Output: {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

### Lifecycle Errors

```typescript
const transport = new StdioTransport();

// Error: Cannot start twice
await transport.start(dispatch);
await transport.start(dispatch); // Throws: "StdioTransport is already started"

// Safe: Multiple stops are allowed
await transport.stop();
await transport.stop(); // No error
```

## API Reference

### StdioTransport

Implements the `ServerTransport` interface from `@hexmcp/transport`.

#### Properties

- `readonly name: string` - Always returns `"stdio"`

#### Methods

- `start(dispatch: TransportDispatch): Promise<void>` - Start processing stdin
- `stop(): Promise<void>` - Stop processing and cleanup

### Transport Metadata

The transport provides metadata in the following format:

```typescript
{
  transport: {
    name: "stdio"
  }
}
```

## Testing

The package includes comprehensive tests covering:

- Interface compliance with `ServerTransport`
- Lifecycle management (start/stop scenarios)
- Valid JSON-RPC message processing
- Invalid JSON error handling
- NDJSON protocol compliance
- Concurrent message processing
- Edge cases and error conditions

Run tests:

```bash
npm test
npm run test:coverage
```

## Integration Notes

### Current Usage

The transport is designed to work with the existing transport registry system:

```typescript
// Manual registration (current approach)
const transport = new StdioTransport();
// Use with internal registry APIs
```

### Future Builder Integration

The transport is designed for future builder DSL integration:

```typescript
// Future API (not yet implemented)
const server = builder
  .transport(new StdioTransport())
  .build();

await server.start();
```

## Performance Considerations

- Uses Node.js `readline.createInterface()` for efficient line processing
- No message buffering - immediate processing of complete lines
- Minimal memory overhead with streaming approach
- Graceful handling of backpressure through readline interface

## Compatibility

- Node.js 16+ (ES2022 target)
- TypeScript 5.0+
- Compatible with all MCP transport registry patterns
- Works with any JSON-RPC 2.0 compliant message dispatcher

## License

MIT
