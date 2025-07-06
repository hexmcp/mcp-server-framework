# MCP Server Framework Examples

Practical code examples demonstrating framework capabilities.

## 🏗️ Basic Examples

### [Hello World Server](./hello-world.md)
The simplest possible MCP server implementation.

#### Simple Version (Recommended)
```typescript
import { createMcpKitServer } from '@hexmcp/core';

// StdioTransport is automatically added - no explicit transport needed!
const server = createMcpKitServer()
  .tool('hello', {
    description: 'Say hello',
    parameters: { type: 'object', properties: {} },
    handler: async () => ({
      content: [{ type: 'text', text: 'Hello, World!' }]
    })
  })
  .listen();
```

#### Explicit Transport Version
```typescript
import { createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

// Explicit transport configuration for advanced use cases
const server = createMcpKitServer()
  .tool('hello', {
    description: 'Say hello',
    parameters: { type: 'object', properties: {} },
    handler: async () => ({
      content: [{ type: 'text', text: 'Hello, World!' }]
    })
  })
  .transport(new StdioTransport())
  .listen();
```

### [Echo Server](./echo-server.md)
Server that echoes back user input with validation.

### [Calculator Server](./calculator.md)
Mathematical operations with parameter validation.

## 🔧 Middleware Examples

### [Authentication Middleware](./auth-middleware.md)
Custom authentication and authorization.

### [Logging Middleware](./logging-middleware.md)
Request/response logging with structured output.

### [Rate Limiting](./rate-limiting.md)
Request rate limiting and throttling.

## 🚀 Advanced Examples

### [Multi-Transport Server](./multi-transport.md)
Server supporting multiple transport protocols simultaneously.

### [Database Integration](./database.md)
Connecting to databases with connection pooling.

### [File System Tools](./filesystem.md)
File operations with security considerations.

### [AI Integration](./ai-integration.md)
Integrating with AI services and APIs.

## 🧪 Testing Examples

### [Unit Testing](./unit-testing.md)
Testing individual components and middleware.

### [Integration Testing](./integration-testing.md)
End-to-end testing with mock transports.

### [Fixture Testing](./fixture-testing.md)
Using the framework's fixture system.

## 📦 Complete Applications

### [Development Assistant](./dev-assistant/)
Complete MCP server for development workflows.

### [Content Manager](./content-manager/)
File and content management server.

### [API Gateway](./api-gateway/)
MCP server acting as an API gateway.

## 🚀 Transport Configuration Patterns

### Automatic Transport (Default)
```typescript
// Simplest approach - StdioTransport is automatically added
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .listen();
```

### Explicit Transport
```typescript
import { StdioTransport } from '@hexmcp/transport-stdio';

// Explicit transport for advanced configuration
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new StdioTransport())
  .listen();
```

### Custom Transport Setup
```typescript
// Disable default transport for custom configurations
const server = createMcpKitServer()
  .noDefaultTransport()
  .transport(new CustomTransport())
  .transport(new AnotherTransport())
  .listen();
```

### Environment-Based Configuration
```bash
# Disable default transport globally
MCPKIT_NO_DEFAULT_TRANSPORT=true node server.js
```

## 🎯 Usage Notes

- All examples include complete, runnable code
- Examples progress from simple to complex
- Each example includes setup instructions and explanations
- Check the [Guides](../guides/README.md) for detailed explanations

---

*Examples are tested with each framework release to ensure compatibility.*
