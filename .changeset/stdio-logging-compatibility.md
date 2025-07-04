---
"@hexmcp/core": minor
"@hexmcp/transport-stdio": patch
---

Add transport-aware logging for stdio compatibility

This change resolves the issue where console-based logging interferes with MCP client handshake over stdio transport by introducing transport-aware logger utilities and automatic logger selection.

## Core Package Changes

### New Logger Utilities
- **`createStderrLogger()`**: Creates a logger that writes structured JSON logs to stderr only, safe for stdio transport
- **`createSilentLogger()`**: Creates a no-op logger that discards all output, useful for completely disabling logging

### Enhanced Built-in Logging Middleware
- **Automatic Transport Detection**: `createBuiltInLoggingMiddleware()` now automatically detects stdio transport and uses stderr-only logging
- **Custom Logger Override**: When a custom logger is provided, it overrides automatic transport detection
- **Backward Compatibility**: Existing usage continues to work unchanged

### Streaming Info Support
- **`StreamingRequestContext`**: New interface extending `RequestContext` with optional `streamInfo` method
- **`createStreamingInfoMiddleware()`**: Middleware that adds `streamInfo` method for client-visible progress updates
- **Transport-Aware**: Only adds `streamInfo` for non-stdio transports to avoid protocol interference

## Transport-Stdio Package Changes

### Comprehensive Logging Compatibility Tests
- Tests demonstrating stdout pollution problems with traditional logging
- Tests showing safe stderr logging patterns
- Tests verifying JSON-RPC protocol integrity with proper logging setup
- Examples of correct logging patterns for stdio transport

## Usage Examples

### Automatic Transport-Aware Logging
```typescript
const server = createMcpKitServer()
  .use(builtIn.logging()) // Automatically uses stderr for stdio transport
  .transport(new StdioTransport());
```

### Custom Logger with Stdio Safety
```typescript
const server = createMcpKitServer()
  .use(builtIn.logging({
    logger: (level, message, data) => {
      // Safe for stdio - writes to stderr only
      const stderrLogger = createStderrLogger();
      stderrLogger.log(level, message, data);
    }
  }))
  .transport(new StdioTransport());
```

### Streaming Progress Updates
```typescript
const server = createMcpKitServer()
  .use(createStreamingInfoMiddleware())
  .tool('process-data', {
    handler: async (args, ctx) => {
      const streamingCtx = ctx as StreamingRequestContext;
      streamingCtx.streamInfo?.('Processing started...');
      // ... processing logic
      streamingCtx.streamInfo?.('Processing completed');
      return result;
    }
  });
```

## Breaking Changes
None. All changes are backward compatible.

## Migration Guide
No migration required. Existing code will automatically benefit from transport-aware logging when using stdio transport.
