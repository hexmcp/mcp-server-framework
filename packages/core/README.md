# @hexmcp/core

Core functionality for MCP Server Framework with lifecycle state machine, handshake system, and middleware execution engine.

## Features

- 🔄 **Lifecycle Management**: Finite state machine for MCP protocol compliance
- 🛡️ **Request Gating**: Prevents premature operational requests
- 🧅 **Middleware System**: Onion-style middleware execution with async/await support
- 🔌 **Transport Integration**: Seamless integration with transport adapters
- 📝 **TypeScript First**: Full type safety with comprehensive interfaces
- ✅ **Well Tested**: 80%+ test coverage with comprehensive edge case testing

## Installation

```bash
npm install @hexmcp/core
```

## Quick Start

### Basic Lifecycle Management

```typescript
import {
  McpLifecycleManager,
  McpCapabilityRegistry,
  McpRequestGate,
  MockPrimitiveRegistry,
} from '@hexmcp/core';

const primitiveRegistry = new MockPrimitiveRegistry();
const capabilityRegistry = new McpCapabilityRegistry(primitiveRegistry);
const lifecycleManager = new McpLifecycleManager(capabilityRegistry);
const requestGate = new McpRequestGate(lifecycleManager);

// Initialize the server
await lifecycleManager.initialize({
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: { experimental: {}, sampling: {} },
    clientInfo: { name: 'Test Client', version: '1.0.0' },
  },
});

// Check if requests can be processed
if (requestGate.canProcessRequest('tools/list')) {
  // Process the request
}
```

### Middleware System

```typescript
import {
  McpMiddlewareRegistry,
  McpMiddlewareEngine,
  MiddlewareDispatcher,
  type Middleware,
  type RequestContext,
  type LoggerRequestContext,
} from '@hexmcp/core';

// Create middleware components
const middlewareRegistry = new McpMiddlewareRegistry();
const middlewareEngine = new McpMiddlewareEngine();

// Define custom middleware
const loggingMiddleware: Middleware = async (ctx, next) => {
  const loggerCtx = ctx as LoggerRequestContext;

  loggerCtx.log.info('Request started', {
    method: ctx.request.method,
    requestId: ctx.request.id,
    transport: ctx.transport.name
  });
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  loggerCtx.log.info('Request completed', {
    method: ctx.request.method,
    requestId: ctx.request.id,
    durationMs: duration,
    transport: ctx.transport.name
  });
};

const authMiddleware: Middleware = async (ctx, next) => {
  // Authenticate request
  const isAuthenticated = await authenticateRequest(ctx.request);
  
  if (!isAuthenticated) {
    ctx.response = createErrorResponse(ctx.request.id, -32000, 'Authentication failed');
    return;
  }
  
  ctx.state.authenticated = true;
  ctx.state.user = { id: 'user-123', name: 'John Doe' };
  
  await next();
};

// Register middleware (first registered = outermost layer)
middlewareRegistry.registerMiddleware(loggingMiddleware);
middlewareRegistry.registerMiddleware(authMiddleware);

// Create dispatcher
const dispatcher = new MiddlewareDispatcher({
  requestGate,
  middlewareRegistry,
  middlewareEngine,
  coreDispatcher: async (ctx) => {
    // Your core business logic here
    ctx.response = createSuccessResponse(ctx.request.id, { result: 'processed' });
  },
});

// Create transport dispatch function
const transportDispatch = dispatcher.createTransportDispatch('stdio');
```

### Builder Pattern Integration

```typescript
import {
  addMiddlewareSupport,
  createMiddlewareBuilder,
  type ServerBuilderWithMiddleware,
} from '@hexmcp/core';

// Enhance existing builder with middleware support
interface MyServerBuilder {
  withTransport(transport: any): this;
  build(): MyServer;
}

const builder: MyServerBuilder = {
  withTransport: function(transport) { return this; },
  build: function() { return new MyServer(); },
};

const middlewareRegistry = new McpMiddlewareRegistry();
const enhancedBuilder = addMiddlewareSupport(builder, middlewareRegistry);

// Now supports fluent middleware registration
enhancedBuilder
  .use(loggingMiddleware)
  .use(authMiddleware)
  .withTransport(stdioTransport)
  .build();
```

## API Reference

### Lifecycle Management

#### `McpLifecycleManager`

Manages the server lifecycle according to MCP protocol specification.

**States**: `idle` → `initializing` → `ready` → `shutting-down`

```typescript
const manager = new McpLifecycleManager(capabilityRegistry);

// Initialize server
await manager.initialize(initializeRequest);

// Check state
logger.info('Server state', {
  currentState: manager.currentState, // 'ready'
  isReady: manager.isReady // true
});

// Shutdown
await manager.shutdown('Server shutdown requested');
```

#### `McpRequestGate`

Validates requests against current lifecycle state.

```typescript
const gate = new McpRequestGate(lifecycleManager);

// Check if request can be processed
if (gate.canProcessRequest('tools/list')) {
  // Process request
}

// Get validation error details
const error = gate.getValidationError('tools/list');
if (error) {
  logger.warn('Request validation failed', {
    code: error.code,
    message: error.message,
    method: 'tools/list'
  });
}
```

### Middleware System

#### `Middleware` Type

```typescript
type Middleware = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

interface RequestContext {
  request: JsonRpcRequest;
  response?: JsonRpcResponse;
  send: (message: unknown) => Promise<void>;
  transport: { name: string; peer?: unknown };
  state: Record<string, unknown>; // Mutable shared state
}
```

#### `McpMiddlewareRegistry`

Manages middleware registration and ordering.

```typescript
const registry = new McpMiddlewareRegistry();

registry.registerMiddleware(middleware);
registry.insertMiddleware(middleware, 1); // Insert at specific position
registry.removeMiddleware(middleware);
registry.clear();

const stack = registry.getMiddlewareStack();
```

#### `McpMiddlewareEngine`

Executes middleware in onion-style pattern.

```typescript
const engine = new McpMiddlewareEngine();

// Compose middleware stack
const composedMiddleware = engine.applyMiddleware([
  authMiddleware,
  loggingMiddleware,
  rateLimitMiddleware,
]);

// Execute with context
await composedMiddleware(ctx, finalHandler);

// Execute with infinite loop prevention options
await engine.executeMiddleware(ctx, middleware, {
  timeout: 10000,  // 10 second timeout
  maxDepth: 50     // Maximum call depth
});
```

#### `MiddlewareDispatcher`

Integrates middleware with transport layer and request gating.

```typescript
const dispatcher = new MiddlewareDispatcher({
  requestGate,
  middlewareRegistry,
  middlewareEngine,
  coreDispatcher: async (ctx) => {
    // Your business logic
  },
});

const transportDispatch = dispatcher.createTransportDispatch('stdio');
```

## Infinite Loop Prevention

The middleware system includes comprehensive protection against infinite loops:

```typescript
// Execution timeout protection (default: 30 seconds)
try {
  await engine.executeMiddleware(ctx, middleware, { timeout: 5000 });
} catch (error) {
  if (error instanceof MiddlewareTimeoutError) {
    ctx.log.error('Middleware execution timed out', {
      timeout: 5000,
      method: ctx.request.method,
      requestId: ctx.request.id
    });
  }
}

// Call depth protection (default: 100)
try {
  await engine.executeMiddleware(ctx, middleware, { maxDepth: 20 });
} catch (error) {
  if (error.message.includes('Maximum call depth exceeded')) {
    ctx.log.error('Middleware call stack too deep', {
      maxDepth: 20,
      method: ctx.request.method,
      requestId: ctx.request.id,
      error: error.message
    });
  }
}

// Re-entrant call detection
const problematicMiddleware: Middleware = async (ctx, next) => {
  await next();
  await next(); // This will throw ReentrantCallError
};
```

## Error Handling

The middleware system provides comprehensive error handling:

```typescript
// Middleware errors are wrapped with context
try {
  await engine.executeMiddleware(ctx, middleware);
} catch (error) {
  if (error instanceof MiddlewareError) {
    ctx.log.error('Middleware execution failed', {
      middlewareIndex: error.middlewareIndex,
      message: error.message,
      cause: error.cause,
      method: ctx.request.method,
      requestId: ctx.request.id
    });
  }
}

// Re-entrant call detection
try {
  await engine.executeMiddleware(ctx, [reentrantMiddleware]);
} catch (error) {
  if (error instanceof ReentrantCallError) {
    ctx.log.error('Re-entrant call detected', {
      method: ctx.request.method,
      requestId: ctx.request.id,
      error: error.message
    });
  }
}
```

## Testing

The package includes comprehensive test utilities:

```typescript
import {
  createMockRequestContext,
  createLoggingMiddleware,
  createAuthMiddleware,
  SAMPLE_JSON_RPC_REQUEST,
} from '@hexmcp/core/test-fixtures';

// Create mock context for testing
const ctx = createMockRequestContext({
  request: SAMPLE_JSON_RPC_REQUEST,
  transport: { name: 'test-transport' },
});

// Test middleware execution
const logs: string[] = [];
const middleware = createLoggingMiddleware('test', logs);

await engine.executeMiddleware(ctx, [middleware]);
expect(logs).toEqual(['test:before', 'test:after']);
```
