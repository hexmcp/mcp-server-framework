# @mcp-server-framework/transport

Transport abstraction layer for MCP Server Framework providing a clean interface between transport mechanisms and core server logic.

## Features

- 🔌 **Transport Agnostic**: Clean abstraction supporting stdio, HTTP-SSE, WebSocket, and custom transports
- 🔄 **Lifecycle Management**: Proper start/stop semantics with state tracking
- 📡 **Message Dispatch**: Structured message handling with response callbacks
- 🏷️ **Metadata Support**: Extensible metadata system for transport-specific context
- 🧪 **Testing Utilities**: MockTransport for comprehensive testing scenarios
- 📝 **TypeScript First**: Full type safety with comprehensive interfaces
- ⚡ **High Performance**: Designed for high-throughput message processing

## Installation

```bash
npm install @mcp-server-framework/transport
```

## Quick Start

### Implementing a Custom Transport

```typescript
import type { ServerTransport, TransportDispatch } from '@mcp-server-framework/transport';

class StdioTransport implements ServerTransport {
  readonly name = "stdio";
  private dispatch?: TransportDispatch;

  async start(dispatch: TransportDispatch): Promise<void> {
    this.dispatch = dispatch;
    
    process.stdin.on('data', (data) => {
      const message = JSON.parse(data.toString());
      
      const respond = async (response: unknown) => {
        process.stdout.write(JSON.stringify(response) + '\n');
      };
      
      dispatch(message, respond);
    });
  }

  async stop(): Promise<void> {
    process.stdin.removeAllListeners('data');
    this.dispatch = undefined;
  }
}
```

### Using MockTransport for Testing

```typescript
import { MockTransport } from '@mcp-server-framework/transport';

const transport = new MockTransport({ name: "test-transport" });

const dispatch = (message, respond, metadata) => {
  console.log('Received:', message);
  console.log('From:', metadata?.peer?.ip);
  respond({ result: "processed" });
};

await transport.start(dispatch);

// Send test messages
transport.sendMessage({ method: "test" }, {
  peer: { ip: "127.0.0.1" }
});

// Check responses
console.log(transport.responses); // [{ response: { result: "processed" }, ... }]

await transport.stop();
```

## Core Interfaces

### ServerTransport

The main transport interface that all transport implementations must follow:

```typescript
interface ServerTransport {
  readonly name: string;           // Unique identifier for logging/debugging
  start(dispatch: TransportDispatch): Promise<void>;  // Begin message processing
  stop(): Promise<void>;           // Graceful shutdown
}
```

### TransportDispatch

Function signature for handling incoming messages:

```typescript
type TransportDispatch = (
  message: unknown,                                    // Decoded JSON message
  respond: (response: unknown) => Promise<void>,       // Response callback
  metadata?: TransportMetadata                         // Optional context
) => void;
```

### TransportMetadata

Structured metadata for request context:

```typescript
interface TransportMetadata {
  peer?: {
    ip?: string;                    // Client IP address
    userAgent?: string;             // User-Agent header
    headers?: Record<string, string>; // HTTP headers or equivalent
    [key: string]: unknown;         // Transport-specific extensions
  };
  [key: string]: unknown;           // Top-level extensions
}
```

## Transport Lifecycle

### 1. Server Initialization

```typescript
const transport = new MyTransport();
const server = new McpServer();

// Register transport with server
server.addTransport(transport);

// Start server (calls transport.start())
await server.start();
```

### 2. Message Processing

When a message arrives:

1. Transport receives raw data
2. Transport decodes to JSON
3. Transport calls `dispatch(message, respond, metadata)`
4. Core server processes message
5. Core server calls `respond(result)` exactly once
6. Transport sends response back to client

### 3. Shutdown

```typescript
// Graceful shutdown
await server.stop(); // Calls transport.stop() on all transports
```

## Concurrency

Transports should handle multiple simultaneous messages:

- Each message gets its own `respond` callback
- Responses can be sent in any order
- Transport must track message/response correlation
- No shared state between message handlers

## Error Handling

### Transport Errors

```typescript
try {
  await transport.start(dispatch);
} catch (error) {
  console.error('Transport failed to start:', error);
  // Handle startup failure
}
```

### Dispatch Errors

```typescript
const dispatch = (message, respond, metadata) => {
  try {
    // Process message
    respond({ result: "success" });
  } catch (error) {
    // Send error response
    respond({ 
      error: { 
        code: -32603, 
        message: "Internal error" 
      } 
    });
  }
};
```

### Response Errors

```typescript
const dispatch = async (message, respond, metadata) => {
  try {
    await respond({ result: "success" });
  } catch (error) {
    console.error('Failed to send response:', error);
    // Transport should handle send failures
  }
};
```

## Testing

The package includes comprehensive testing utilities:

### MockTransport Features

- **Message Injection**: Send synthetic messages programmatically
- **Response Capture**: Inspect all responses sent
- **Lifecycle Testing**: Test start/stop behavior
- **Error Simulation**: Simulate transport failures
- **State Tracking**: Monitor transport state changes

### Example Test

```typescript
import { MockTransport, TransportState } from '@mcp-server-framework/transport';

describe('My Handler', () => {
  it('should process messages correctly', async () => {
    const transport = new MockTransport();
    
    await transport.start(myDispatchHandler);
    
    transport.sendMessage({ method: "test", params: [1, 2] });
    
    expect(transport.responses).toHaveLength(1);
    expect(transport.responses[0].response).toEqual({ result: 3 });
    
    await transport.stop();
  });
});
```

## Best Practices

1. **Idempotent Operations**: `stop()` should be safe to call multiple times
2. **Resource Cleanup**: Always clean up resources in `stop()`
3. **Error Isolation**: Don't let dispatch errors crash the transport
4. **Response Guarantee**: Always call `respond()` exactly once per message
5. **State Management**: Track transport state properly
6. **Metadata Preservation**: Pass through relevant context information

## Examples

See the `test/` directory for comprehensive examples of:
- Custom transport implementations
- Error handling patterns
- Middleware-like message processing
- Multiple transport coordination
- High-volume message handling
