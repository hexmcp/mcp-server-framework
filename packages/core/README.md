# @hexmcp/core

Core functionality for MCP Server Framework with lifecycle state machine, handshake system, and middleware execution engine.

## Features

- 🔄 **Lifecycle Management**: Finite state machine for MCP protocol compliance with proper error codes
- 🛡️ **Request Gating**: Prevents premature operational requests with -32002/-32003 error codes
- 🧅 **Middleware System**: Onion-style middleware execution with async/await support
- 🔌 **Transport Integration**: Seamless integration with transport adapters
- 📝 **TypeScript First**: Full type safety with comprehensive interfaces
- ✅ **Well Tested**: 95%+ test coverage with comprehensive edge case testing
- 🛠️ **MCP Protocol Compliance**: Full compliance with MCP protocol including proper `tools/list` responses with JSON Schema
- 🎯 **Resource Pattern Matching**: Advanced URI pattern matching with wildcard support and trailing slash normalization
- 🔧 **Builder Pattern**: Fluent API for server configuration with middleware support
- 🚨 **Error Handling**: Comprehensive error handling with proper JSON-RPC error responses

## Installation

```bash
npm install @hexmcp/core
```

## Recent Improvements

### v0.0.7 - Production Ready Enhancements

- **🔧 Fixed Resource Pattern Matching**: Improved URI pattern matching to handle both empty pathname ("") and root pathname ("/") correctly, including edge cases for trailing slashes and wildcard patterns
- **🔄 Enhanced MCP Lifecycle Management**: Added proper finite state machine with error codes -32002 for pre-initialization and -32003 for post-shutdown rejection
- **🧪 Comprehensive Testing**: Added extensive test suites including integration tests, protocol compliance tests, and error handling scenarios
- **🛡️ Improved Error Handling**: Enhanced error mapper middleware with consistent JSON-RPC error responses and environment-based debug mode
- **📚 Better Documentation**: Updated with comprehensive examples, troubleshooting guides, and best practices

## Quick Start

### Modern Builder Pattern (Recommended)

```typescript
import { createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

// Create a complete MCP server with fluent API
const server = createMcpKitServer()
  .transport(new StdioTransport({ silent: true }))
  .tool('echo', {
    description: 'Echo back the input',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    handler: async (args) => {
      return {
        content: [{ type: 'text', text: `Echo: ${args.message}` }],
      };
    },
  })
  .resource('file://**', {
    name: 'File System',
    description: 'Access to local files',
    provider: {
      get: async (uri) => {
        const content = await fs.readFile(uri.replace('file://', ''), 'utf8');
        return { uri, mimeType: 'text/plain', text: content };
      },
      list: async () => ({ resources: [] }),
    },
  })
  .use(async (ctx, next) => {
    console.log(`Processing ${ctx.request.method}`);
    await next();
  });

// Start the server
await server.listen();
```

### Direct API Usage (Advanced)

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

## Troubleshooting

### Common Issues

#### Resource Pattern Matching

**Problem**: Resources not matching expected URIs
```typescript
// ❌ Problematic pattern - doesn't handle trailing slashes
registry.register('api://service', provider);

// ✅ Better pattern - handles trailing slash variations
registry.register('api://service/**', provider);
```

**Solution**: Use wildcard patterns and the framework automatically handles trailing slash normalization.

#### MCP Lifecycle Errors

**Problem**: Getting -32002 or -32003 errors
```typescript
// ❌ Calling tools before initialization
await toolRegistry.call('my-tool', args); // Throws -32002

// ✅ Proper lifecycle management
await lifecycleManager.initialize(initRequest);
await lifecycleManager.initialized();
await toolRegistry.call('my-tool', args); // Works correctly
```

**Solution**: Always follow the proper MCP lifecycle: initialize → initialized → ready state before processing requests.

#### Transport Silent Mode

**Problem**: Console output interfering with JSON-RPC
```typescript
// ❌ Default stdio transport may pollute stdout
new StdioTransport()

// ✅ Use silent mode for clean JSON-RPC communication
new StdioTransport({ silent: true })
```

**Solution**: Enable silent mode to redirect console output to stderr and keep stdout clean for JSON-RPC.

### Best Practices

1. **Always use the builder pattern** for new projects - it provides better defaults and error handling
2. **Enable silent mode** for stdio transports in production
3. **Use wildcard patterns** for resource URIs to handle edge cases automatically
4. **Follow MCP lifecycle** strictly to avoid protocol violations
5. **Add comprehensive error handling** middleware for production deployments

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
