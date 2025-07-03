# MCP Server Framework Documentation

Welcome to the comprehensive documentation for the MCP Server Framework - a TypeScript-first framework for building Model Context Protocol (MCP) servers.

## 📚 Documentation Structure

### [API Reference](./api/README.md)
Complete TypeScript API documentation generated from source code with TypeDoc.
- **Classes**: Core framework classes and their methods
- **Interfaces**: Type definitions and contracts
- **Functions**: Utility functions and factory methods
- **Types**: Type aliases and enumerations

### [Guides](./guides/)
Step-by-step tutorials and comprehensive guides for framework usage.
- Getting Started
- Architecture Overview
- Middleware Development
- Transport Integration
- Testing Strategies

### [Examples](./examples/)
Practical code examples and sample implementations.
- Basic Server Setup
- Custom Middleware
- Transport Adapters
- Registry Implementations

### [Reference](./reference/)
Technical reference materials and specifications.
- Configuration Options
- Error Codes
- Protocol Compliance
- Performance Guidelines

## 🚀 Quick Start

```typescript
import { createMcpKitServer } from '@hexmcp/core';

const server = createMcpKitServer()
  .tool('echo', {
    description: 'Echo back the input',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    handler: async ({ message }) => ({ content: [{ type: 'text', text: message }] })
  })
  .transport(/* your transport */)
  .listen();
```

## 📖 Key Concepts

- **Lifecycle Management**: Finite state machine for MCP protocol compliance
- **Middleware System**: Onion-style middleware execution with async/await support
- **Transport Abstraction**: Support for multiple transport protocols
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## 🔗 Related Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [GitHub Repository](https://github.com/your-org/mcp-server-framework)
- [NPM Packages](https://www.npmjs.com/org/hexmcp)

---

*Generated documentation is automatically updated with each release.*
