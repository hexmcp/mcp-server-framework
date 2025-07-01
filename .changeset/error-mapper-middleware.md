---
"@hexmcp/core": minor
---

Add comprehensive Error Mapper Middleware as outermost safety net

This release introduces the Error Mapper Middleware, a production-ready error handling system that serves as the outermost layer in the middleware stack, ensuring all uncaught exceptions are properly converted to JSON-RPC 2.0 error responses.

## New Features

### Error Mapper Middleware
- **Comprehensive Error Classification**: 13 different error types with appropriate JSON-RPC error codes
- **Environment-Based Debug Mode**: Controlled by `MCPKIT_DEBUG=1` environment variable
- **Structured Logging**: Rich logging with correlation IDs, request context, and metadata
- **Production Safety**: No sensitive data leaks in production mode
- **Custom Error Mapping**: Support for custom error mappers and hooks
- **Built-in Integration**: Seamless integration with middleware builder pattern

### Error Classification System
- `RPC_ERROR`: Pass-through for existing RpcError instances
- `MIDDLEWARE_ERROR/MIDDLEWARE_TIMEOUT/REENTRANT_CALL`: Framework-specific errors (-32603)
- `VALIDATION_ERROR`: Parameter validation failures (-32602)
- `AUTHENTICATION_ERROR/AUTHORIZATION_ERROR`: Security-related errors (-32001)
- `RATE_LIMIT_ERROR`: Rate limiting violations (-32002)
- `TIMEOUT_ERROR/NETWORK_ERROR`: Infrastructure-related errors
- `PARSE_ERROR`: JSON/syntax parsing failures (-32700)
- `STANDARD_ERROR/UNKNOWN_ERROR`: Fallback classifications

### Factory Functions
- `createErrorMapperMiddleware(options?)`: Main factory with comprehensive options
- `createErrorMapperMiddlewareWithDefaults()`: Convenience factory with sensible defaults

### Built-in Middleware Support
- `builtIn.errorMapper(options?)`: Fluent builder integration
- `createBuiltInErrorMapperMiddleware(options?)`: Direct built-in middleware creation

## Usage Examples

### Basic Usage
```typescript
import { createErrorMapperMiddleware } from '@hexmcp/core';

// Register as first (outermost) middleware
const errorMapper = createErrorMapperMiddleware({
  enableLogging: true,
  includeRequestContext: true
});
middlewareRegistry.registerMiddleware(errorMapper);
```

### Production Configuration
```typescript
const errorMapper = createErrorMapperMiddleware({
  debugMode: false,
  enableLogging: true,
  logLevel: 'error',
  includeStackTrace: false,
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
  includeRequestContext: true
});
```

### Custom Error Mapping
```typescript
const errorMapper = createErrorMapperMiddleware({
  customErrorMapper: (error, ctx) => {
    if (error instanceof MyCustomError) {
      return {
        code: -32000,
        message: 'Custom application error',
        data: { type: error.type }
      };
    }
    return null; // Fall back to default mapping
  }
});
```

## Debug Mode

Set `MCPKIT_DEBUG=1` to enable debug mode:
- Error details included in responses
- Stack traces available (if `includeStackTrace: true`)
- Original error messages preserved
- Additional metadata in structured logs

## Structured Logging

Rich JSON-formatted logs with:
- Error classification and severity
- Request context (ID, method, transport)
- Correlation IDs for distributed tracing
- Environment metadata
- Optional stack traces

## Breaking Changes

None. This is a new feature that doesn't affect existing functionality.

## Migration Guide

No migration required. The Error Mapper Middleware is opt-in and can be added to existing middleware stacks:

```typescript
// Add as first middleware for comprehensive error handling
middlewareRegistry.registerMiddleware(createErrorMapperMiddleware());
// ... existing middleware
```

## Documentation

- Complete API documentation with usage examples
- Architecture documentation explaining error classification
- Best practices for production and development configurations
- Integration examples with various middleware patterns
