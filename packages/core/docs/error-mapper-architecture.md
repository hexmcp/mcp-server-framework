# Error Mapper Middleware Architecture

## Overview

The Error Mapper Middleware serves as the outermost safety net layer in the MCP Server Framework's onion-style middleware system. It catches all uncaught exceptions and converts them to proper JSON-RPC 2.0 error responses, ensuring that no unhandled errors escape the middleware stack.

## Architecture Principles

### 1. Outermost Layer Position
- **Registration Order**: First middleware registered = outermost layer in execution
- **Execution Pattern**: Wraps all other middleware in try-catch block
- **Responsibility**: Final error handling before response transmission

### 2. Error Classification Strategy
```typescript
// Error Type Hierarchy (highest to lowest priority)
1. RpcError           → Pass-through with debug mode handling
2. MiddlewareError    → Convert to JSON-RPC internal error (-32603)
3. MiddlewareTimeoutError → Convert to JSON-RPC internal error (-32603)
4. ReentrantCallError → Convert to JSON-RPC internal error (-32603)
5. Standard Error     → Convert with message preservation
6. Unknown types      → Safe fallback handling
```

### 3. Debug Mode Integration
- **Environment Variable**: `MCPKIT_DEBUG=1`
- **Stack Trace Handling**: Leverages existing RpcError debug functionality
- **Production Safety**: No sensitive information leaked in production mode

## Interface Design

### ErrorMapperOptions
```typescript
interface ErrorMapperOptions {
  debugMode?: boolean;                    // Override environment detection
  enableLogging?: boolean;                // Enable structured logging
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  customErrorMapper?: ErrorMapper;        // Custom error mapping function
  includeStackTrace?: boolean;            // Force stack trace inclusion
  includeRequestContext?: boolean;        // Include request metadata in logs
  onError?: ErrorCallback;                // Custom error handling hook
}
```

### Error Context
```typescript
interface ErrorContext {
  originalError: unknown;
  errorType: string;
  timestamp: number;
  requestId: string | number | null;
  method: string;
  transportName: string;
  executionId?: string;
  middlewareStack?: string[];
}
```

## Integration Patterns

### 1. Middleware Registration
```typescript
// Error mapper should be registered FIRST (outermost layer)
const registry = new McpMiddlewareRegistry();
registry.registerMiddleware(createErrorMapperMiddleware(options));
registry.registerMiddleware(authMiddleware);
registry.registerMiddleware(loggingMiddleware);
```

### 2. Builder Pattern Integration
```typescript
const builder = new McpMiddlewareBuilder(registry);
builder
  .use(createErrorMapperMiddleware({ enableLogging: true }))
  .use(authMiddleware)
  .use(loggingMiddleware);
```

### 3. Built-in Middleware Support
```typescript
interface BuiltInMiddleware {
  errorMapper(options?: ErrorMapperOptions): Middleware;
  // ... other built-in middleware
}
```

## Error Handling Flow

```
1. Request enters middleware stack
2. Error Mapper wraps execution in try-catch
3. Inner middleware execute (auth, logging, etc.)
4. If error occurs:
   a. Error Mapper catches exception
   b. Classifies error type
   c. Maps to appropriate JSON-RPC error code
   d. Logs error details (if enabled)
   e. Sets ctx.response with error response
   f. Calls onError hook (if provided)
5. Response transmitted to client
```

## Structured Logging

### Log Entry Format
```typescript
{
  level: 'error',
  message: 'Middleware error caught',
  error: {
    type: 'MiddlewareTimeoutError',
    code: -32603,
    message: 'Internal error',
    originalMessage: 'Middleware execution timed out...'
  },
  context: {
    requestId: 'req-123',
    method: 'prompts/list',
    transport: 'stdio',
    timestamp: 1672531200000
  },
  stack: '...' // Only in debug mode
}
```

## Environment Variable Handling

### Debug Mode Detection
```typescript
function isDebugMode(options?: ErrorMapperOptions): boolean {
  if (options?.debugMode !== undefined) {
    return options.debugMode;
  }
  return process.env.MCPKIT_DEBUG === '1';
}
```

## Factory Function Design

### createErrorMapperMiddleware
```typescript
function createErrorMapperMiddleware(options?: ErrorMapperOptions): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      // Error classification and mapping logic
      const mappedError = mapError(error, ctx, options);
      ctx.response = encodeJsonRpcError(ctx.request.id, mappedError);
      
      // Structured logging
      if (options?.enableLogging) {
        logError(error, ctx, mappedError, options);
      }
      
      // Custom error hook
      if (options?.onError) {
        options.onError(error, ctx, mappedError);
      }
    }
  };
}
```

## Testing Strategy

### Unit Tests
- Error classification scenarios
- Debug mode behavior
- Custom error mapper functions
- Logging output validation

### Integration Tests
- Middleware stack interaction
- Onion pattern execution
- End-to-end error handling
- Transport integration

### Edge Cases
- Null/undefined errors
- Circular reference errors
- Error during error handling
- Memory constraints

## Performance Considerations

### Minimal Overhead
- Only active when errors occur
- Efficient error classification
- Lazy logging evaluation
- No performance impact on success path

### Memory Management
- No error caching
- Immediate error processing
- Garbage collection friendly
