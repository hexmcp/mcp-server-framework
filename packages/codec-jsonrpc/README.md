# @hexmcp/codec-jsonrpc

A transport-agnostic JSON-RPC 2.0 encoder/decoder library for MCP servers and clients.

## Features

- 🔄 **Transport Agnostic**: Works with any transport layer (WebSocket, HTTP, IPC, etc.)
- 🛡️ **Type Safe**: Full TypeScript support with strict type checking
- 📝 **JSON-RPC 2.0 Compliant**: Complete implementation of the JSON-RPC 2.0 specification
- 🚫 **Stateless**: No internal state, pure functions for encoding/decoding
- 🎯 **Error Handling**: Comprehensive error classes with standard JSON-RPC error codes
- ✅ **Well Tested**: 98%+ test coverage with comprehensive edge case testing

## Installation

```bash
npm install @hexmcp/codec-jsonrpc
```

## Quick Start

### Decoding Requests

```typescript
import { decodeJsonRpcRequest, RpcError } from '@hexmcp/codec-jsonrpc';

try {
  const request = decodeJsonRpcRequest('{"jsonrpc":"2.0","id":1,"method":"add","params":[1,2]}');
  console.log(request.method); // "add"
  console.log(request.params); // [1, 2]
} catch (error) {
  if (error instanceof RpcError) {
    console.error('JSON-RPC Error:', error.code, error.message);
  }
}
```

### Encoding Responses

```typescript
import { encodeJsonRpcSuccess, encodeJsonRpcError } from '@hexmcp/codec-jsonrpc';

// Success response
const successResponse = encodeJsonRpcSuccess(1, { sum: 3 });
// { jsonrpc: "2.0", id: 1, result: { sum: 3 } }

// Error response
const errorResponse = encodeJsonRpcError(1, new RpcError(-32601, "Method not found"));
// { jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }
```

### Type Guards

```typescript
import { isJsonRpcRequest, isJsonRpcNotification } from '@hexmcp/codec-jsonrpc';

const message = decodeJsonRpcMessage(jsonString);

if (isJsonRpcRequest(message)) {
  // Handle request (has id, expects response)
  console.log('Request ID:', message.id);
} else if (isJsonRpcNotification(message)) {
  // Handle notification (no id, no response expected)
  console.log('Notification method:', message.method);
}
```

## API Reference

### Types

- `JsonRpcRequest<T>` - JSON-RPC request with optional typed params
- `JsonRpcNotification<T>` - JSON-RPC notification with optional typed params
- `JsonRpcSuccess<T>` - JSON-RPC success response with typed result
- `JsonRpcError` - JSON-RPC error response
- `JsonRpcResponse<T>` - Union of success and error responses
- `JsonRpcMessage<T>` - Union of requests and notifications

### Decoding Functions

- `decodeJsonRpcRequest<T>(input)` - Decode and validate JSON-RPC request
- `decodeJsonRpcNotification<T>(input)` - Decode and validate JSON-RPC notification
- `decodeJsonRpcMessage<T>(input)` - Decode any JSON-RPC message

### Encoding Functions

- `encodeJsonRpcSuccess<T>(id, result)` - Create success response
- `encodeJsonRpcError(id, error)` - Create error response
- `encodeJsonRpcErrorFromPlain(id, code, message, data?)` - Create error from plain values

### Convenience Error Encoders

- `encodeJsonRpcParseError(id?)` - Parse error (-32700)
- `encodeJsonRpcInvalidRequest(id?)` - Invalid request (-32600)
- `encodeJsonRpcMethodNotFound(id)` - Method not found (-32601)
- `encodeJsonRpcInvalidParams(id)` - Invalid params (-32602)
- `encodeJsonRpcInternalError(id)` - Internal error (-32603)

### Error Handling

```typescript
import { RpcError, JSON_RPC_ERROR_CODES } from '@hexmcp/codec-jsonrpc';

// Create custom errors
const customError = new RpcError(-32000, "Custom server error", { details: "..." });

// Use standard error codes
const parseError = RpcError.parseError();
const invalidRequest = RpcError.invalidRequest();
const methodNotFound = RpcError.methodNotFound();
const invalidParams = RpcError.invalidParams();
const internalError = RpcError.internalError();
```

### Debug Mode

The package supports debug mode for enhanced error information:

```typescript
// Enable debug mode via environment variable
process.env.MCPKIT_DEBUG = "1";

const error = new RpcError(-32000, "Server error");

// In debug mode:
// - error.stack contains the full stack trace
// - error.toJSON() includes the stack trace

// In production mode (default):
// - error.stack is undefined (masked for security)
// - error.debugStack contains the original stack trace
// - error.toJSON() excludes the stack trace
```

## Error Codes

Standard JSON-RPC 2.0 error codes are available:

- `-32700` Parse error
- `-32600` Invalid Request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error
- `-32000` to `-32099` Server error range

## License

MIT
