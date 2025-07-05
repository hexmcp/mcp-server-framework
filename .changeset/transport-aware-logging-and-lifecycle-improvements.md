---
"@hexmcp/core": minor
"@hexmcp/examples-note-server": patch
---

# Transport-Aware Logging and Enhanced Lifecycle Management

This release introduces comprehensive transport-aware logging capabilities, enhanced lifecycle management with post-shutdown error handling, and significant build system improvements.

## 🚀 New Features

### Transport-Aware Logging System

- **`createLogger(options)`** - Facade function for automatic logger selection based on transport type
- **`createStderrLogger(options)`** - Stderr-only logger for stdio transport compatibility  
- **`createSilentLogger()`** - No-op logger for complete silence
- **`createChildLogger(baseLogger, metadata)`** - Child logger with enhanced context
- **`createStderrLogger(options)`** - Structured JSON logging to stderr

The logging system automatically selects appropriate loggers:
- **stdio transport**: Uses stderr-only logger to prevent JSON-RPC interference
- **other transports**: Uses console-based logger
- **test environment**: Automatically uses silent logger

### Enhanced Lifecycle Management

- **`PostShutdownError`** - New error type for requests after server shutdown (error code -32003)
- **`hasBeenInitialized`** property - Track if server was ever initialized vs current state
- **Improved state validation** - Better differentiation between not-initialized and post-shutdown states
- **Optional id field support** - Allow optional id in initialize/shutdown request handlers

### Build System Improvements

- **Pre-build cache cleaning** - Automatic removal of stale TypeScript cache files
- **Post-build verification** - Early detection of build issues
- **Enhanced clean scripts** - Remove *.tsbuildinfo files
- **CI/CD improvements** - Clean builds in continuous integration

## 🔧 API Enhancements

### New Logging Utilities

```typescript
// Automatic transport-aware logger selection
const logger = createLogger({ transport: 'stdio', level: 'warn' });

// Stderr-only logger for stdio compatibility
const stderrLogger = createStderrLogger({ compact: true });

// Child logger with context
const requestLogger = createChildLogger(baseLogger, {
  traceId: 'req-123',
  method: 'tools/list'
});
```

### Enhanced Error Handling

```typescript
// New post-shutdown error handling
try {
  await processRequest(method);
} catch (error) {
  if (error instanceof PostShutdownError) {
    // Handle post-shutdown request appropriately
  }
}
```

### Improved Middleware Integration

- **Enhanced logging middleware** with transport-aware logger selection
- **Structured logging** with consistent metadata format
- **Error mapper improvements** with better console usage patterns
- **Streaming info middleware** for progress updates (non-stdio transports)

## 🧪 Testing Improvements

- **MCP protocol compliance tests** - Full initialization sequence validation
- **Real transport integration tests** - End-to-end middleware testing
- **Edge case coverage** - INITIALIZING state and concurrent initialization
- **Error mapper test fixes** - Correct console spy method usage

## 📚 Documentation Updates

- **Enhanced JSDoc** with comprehensive examples and best practices
- **Transport compatibility notes** - Clear guidance on stdio vs other transports
- **Structured logging examples** - Replace console usage with proper logging
- **Build system documentation** - Troubleshooting guide and best practices

## 🔄 Breaking Changes

None. This release maintains full backward compatibility while adding new capabilities.

## 📦 Package Updates

- **@hexmcp/core**: Enhanced with new logging utilities and lifecycle improvements
- **@hexmcp/examples-note-server**: Updated to demonstrate new logging patterns

## 🛠️ Migration Guide

### Updating Logging Patterns

**Before:**
```typescript
console.log('Request processed');
```

**After:**
```typescript
const logger = createLogger({ transport: ctx.transport.name });
logger.info('Request processed', { traceId: ctx.state.traceId });
```

### Enhanced Error Handling

**Before:**
```typescript
// Only handled NotInitializedError
```

**After:**
```typescript
// Now handles both pre-initialization and post-shutdown
if (error instanceof PostShutdownError) {
  return { code: -32003, message: error.message };
}
```

This release significantly improves the developer experience with better logging, more robust lifecycle management, and enhanced build reliability.
