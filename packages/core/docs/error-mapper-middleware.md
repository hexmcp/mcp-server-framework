# Error Mapper Middleware

The Error Mapper Middleware serves as the outermost safety net in the MCP Server Framework's middleware system, ensuring that all uncaught exceptions are properly converted to JSON-RPC 2.0 error responses.

## Overview

The Error Mapper Middleware is designed to:
- Catch all uncaught exceptions from the middleware stack
- Classify errors into appropriate categories
- Convert errors to proper JSON-RPC 2.0 responses
- Provide structured logging with rich context
- Support debug mode for development environments
- Maintain production safety by preventing sensitive data leaks

## Quick Start

### Basic Usage

```typescript
import { createErrorMapperMiddleware } from '@hexmcp/core';

// Create with default options
const errorMapper = createErrorMapperMiddleware();

// Register as the first (outermost) middleware
middlewareRegistry.registerMiddleware(errorMapper);
```

### With Configuration

```typescript
const errorMapper = createErrorMapperMiddleware({
  enableLogging: true,
  logLevel: 'error',
  includeRequestContext: true,
  debugMode: process.env.NODE_ENV === 'development'
});
```

### Using Built-in Middleware

```typescript
import { createBuiltInMiddleware } from '@hexmcp/core';

const builtIn = createBuiltInMiddleware();
const errorMapper = builtIn.errorMapper({
  enableLogging: true,
  includeStackTrace: true
});
```

## Configuration Options

### ErrorMapperOptions

```typescript
interface ErrorMapperOptions {
  debugMode?: boolean;                    // Override environment debug detection
  enableLogging?: boolean;                // Enable structured logging
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  customErrorMapper?: ErrorMapper;        // Custom error mapping function
  includeStackTrace?: boolean;            // Include stack traces in debug mode
  includeRequestContext?: boolean;        // Include request metadata in logs
  logger?: Logger;                        // Custom logger implementation
  logFormat?: 'json' | 'text';           // Log output format
  logFields?: LogFieldConfig;             // Custom log fields and metadata
  onError?: ErrorCallback;                // Custom error handling hook
}
```

### Debug Mode

Debug mode is controlled by the `MCPKIT_DEBUG` environment variable:

```bash
# Enable debug mode
MCPKIT_DEBUG=1 node server.js

# Disable debug mode (default)
MCPKIT_DEBUG=0 node server.js
```

In debug mode:
- Error details are included in responses
- Stack traces are available (if `includeStackTrace: true`)
- Original error messages are preserved
- Additional metadata is logged

## Error Classification

The middleware automatically classifies errors into categories:

### Error Types

| Classification | JSON-RPC Code | Description |
|---------------|---------------|-------------|
| `RPC_ERROR` | Original code | Pass-through for existing RpcError |
| `MIDDLEWARE_ERROR` | -32603 | Middleware execution failures |
| `MIDDLEWARE_TIMEOUT` | -32603 | Middleware timeout errors |
| `REENTRANT_CALL` | -32603 | Re-entrant middleware calls |
| `VALIDATION_ERROR` | -32602 | Parameter validation failures |
| `AUTHENTICATION_ERROR` | -32001 | Authentication failures |
| `AUTHORIZATION_ERROR` | -32001 | Authorization failures |
| `RATE_LIMIT_ERROR` | -32002 | Rate limiting violations |
| `TIMEOUT_ERROR` | -32003 | Request timeouts |
| `NETWORK_ERROR` | -32004 | Network connectivity issues |
| `PARSE_ERROR` | -32700 | JSON parsing errors |
| `STANDARD_ERROR` | -32603 | Generic application errors |
| `UNKNOWN_ERROR` | -32603 | Unclassified errors |

### Severity Levels

- **Critical**: System integrity issues (reentrant calls)
- **High**: Framework errors, parse errors, internal errors
- **Medium**: Auth, validation, rate limiting, timeouts
- **Low**: Method not found, general application errors

## Structured Logging

### Log Entry Format

```json
{
  "timestamp": 1672531200000,
  "level": "error",
  "message": "Middleware error caught by error mapper",
  "error": {
    "classification": "middleware_timeout",
    "severity": "high",
    "type": "MiddlewareTimeoutError",
    "code": -32603,
    "message": "Internal error",
    "originalMessage": "Middleware execution timed out after 5000ms"
  },
  "context": {
    "requestId": "req-123",
    "method": "prompts/list",
    "transport": "stdio",
    "timestamp": 1672531200000
  },
  "metadata": {
    "source": "error-mapper",
    "version": "1.0.0",
    "environment": "production",
    "correlationId": "err-1672531200000-abc123def"
  }
}
```

### Custom Logger

```typescript
class CustomLogger implements Logger {
  error(message: string, meta?: LogEntry): void {
    // Send to external logging service
    logService.error(message, meta);
  }
  
  // ... implement other methods
}

const errorMapper = createErrorMapperMiddleware({
  logger: new CustomLogger(),
  enableLogging: true
});
```

## Advanced Usage

### Custom Error Mapping

```typescript
const customMapper = (error: unknown, ctx: RequestContext) => {
  if (error instanceof MyCustomError) {
    return {
      code: -32000,
      message: 'Custom application error',
      data: { type: error.type, details: error.details }
    };
  }
  
  // Fall back to default mapping
  return null;
};

const errorMapper = createErrorMapperMiddleware({
  customErrorMapper: customMapper
});
```

### Error Hooks

```typescript
const errorMapper = createErrorMapperMiddleware({
  onError: (error, ctx, mappedError) => {
    // Send to monitoring service
    monitoring.recordError(error, {
      requestId: ctx.request.id,
      method: ctx.request.method,
      errorCode: mappedError.code
    });
  }
});
```

### Distributed Tracing

```typescript
const errorMapper = createErrorMapperMiddleware({
  enableLogging: true,
  logFields: {
    traceId: getTraceId(),
    spanId: getSpanId(),
    correlationId: getCorrelationId(),
    customFields: {
      service: 'mcp-server',
      version: '1.0.0'
    }
  }
});
```

## Middleware Ordering

**Critical**: The Error Mapper must be registered **first** to act as the outermost layer:

```typescript
// ✅ Correct order
middlewareRegistry.registerMiddleware(errorMapperMiddleware);  // Outermost
middlewareRegistry.registerMiddleware(authMiddleware);
middlewareRegistry.registerMiddleware(loggingMiddleware);
middlewareRegistry.registerMiddleware(rateLimitMiddleware);   // Innermost

// ❌ Incorrect order - errors won't be caught
middlewareRegistry.registerMiddleware(authMiddleware);
middlewareRegistry.registerMiddleware(errorMapperMiddleware); // Too late!
```

## Best Practices

### Production Configuration

```typescript
const errorMapper = createErrorMapperMiddleware({
  debugMode: false,
  enableLogging: true,
  logLevel: 'error',
  includeStackTrace: false,
  includeRequestContext: true,
  logger: productionLogger
});
```

### Development Configuration

```typescript
const errorMapper = createErrorMapperMiddleware({
  debugMode: true,
  enableLogging: true,
  logLevel: 'debug',
  includeStackTrace: true,
  includeRequestContext: true,
  logFormat: 'json'
});
```

### Testing Configuration

```typescript
const errorMapper = createErrorMapperMiddleware({
  enableLogging: false,  // Reduce test noise
  debugMode: true,       // Full error details for debugging
  includeStackTrace: true
});
```

## Error Response Examples

### Production Mode

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

### Debug Mode

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "classification": "middleware_timeout",
      "severity": "high",
      "originalType": "MiddlewareTimeoutError",
      "originalMessage": "Middleware execution timed out after 5000ms",
      "timestamp": 1672531200000
    }
  }
}
```

## Integration Examples

### Express.js Style

```typescript
const server = new McpServer();
server.use(createErrorMapperMiddleware({ enableLogging: true }));
server.use(authMiddleware);
server.use(rateLimitMiddleware);
```

### Builder Pattern

```typescript
const server = createMcpServer()
  .use(createErrorMapperMiddleware())
  .use(authMiddleware)
  .use(loggingMiddleware);
```

### Built-in Middleware

```typescript
const server = createMcpServer();
server.builtIn.errorMapper({ enableLogging: true });
server.builtIn.auth({ apiKey: 'secret' });
server.builtIn.rateLimit({ maxRequests: 100 });
```

## Troubleshooting

### Common Issues

1. **Errors not being caught**: Ensure error mapper is registered first
2. **Missing debug info**: Check `MCPKIT_DEBUG` environment variable
3. **No logs**: Verify `enableLogging: true` and logger configuration
4. **Stack traces missing**: Enable `includeStackTrace: true` in debug mode

### Debugging

```typescript
// Enable verbose logging
const errorMapper = createErrorMapperMiddleware({
  enableLogging: true,
  logLevel: 'debug',
  includeStackTrace: true,
  includeRequestContext: true,
  onError: (error, ctx, mapped) => {
    console.log('Error caught:', error);
    console.log('Context:', ctx);
    console.log('Mapped:', mapped);
  }
});
```
