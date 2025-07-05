---
"@hexmcp/core": minor
---

# Automatic Default Transport for Simplified MCP Server Development

## 🚀 New Feature: Automatic StdioTransport

MCP Kit now automatically adds a `StdioTransport` when no explicit transports are configured, dramatically simplifying the developer experience for basic MCP servers.

### ✨ What's New

**Before (Explicit Transport Required):**
```typescript
import { createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

const server = createMcpKitServer()
  .tool('echo', { /* ... */ })
  .transport(new StdioTransport()) // Required
  .listen();
```

**After (Automatic Transport):**
```typescript
import { createMcpKitServer } from '@hexmcp/core';

const server = createMcpKitServer()
  .tool('echo', { /* ... */ })
  .listen(); // StdioTransport automatically added!
```

### 🎯 Key Benefits

- **Simplified Onboarding**: New developers can create MCP servers with minimal boilerplate
- **Reduced Imports**: No need to import and configure `StdioTransport` for basic use cases
- **Zero Breaking Changes**: All existing explicit transport configurations continue to work unchanged
- **Flexible Control**: Multiple ways to customize or disable the default behavior

### 🔧 Configuration Options

#### Method-Based Control
```typescript
// Disable default transport for this server instance
const server = createMcpKitServer()
  .noDefaultTransport()
  .transport(new CustomTransport())
  .listen();
```

#### Environment Variable Control
```bash
# Disable default transport globally
export MCPKIT_NO_DEFAULT_TRANSPORT=true
node server.js
```

#### Explicit Transport Override
```typescript
// Any explicit .transport() call disables the default
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new StdioTransport()) // Explicit - no default added
  .transport(new HttpTransport())  // Multiple transports
  .listen();
```

### 📚 Updated Examples

All examples have been updated to showcase the simplified API:

- **Note Server**: Demonstrates automatic transport with full MCP functionality
- **Documentation**: Updated with new patterns and migration guide
- **API Reference**: Enhanced with practical examples

### 🔄 Migration Guide

**No action required** - this is a backward-compatible enhancement. Existing projects will continue to work unchanged.

**Optional simplification** for new projects:
1. Remove `StdioTransport` imports
2. Remove `.transport(new StdioTransport())` calls
3. Enjoy the simplified API!

### 🛠️ Technical Details

- **Default Behavior**: Automatically adds `StdioTransport` when no transports are configured
- **Override Logic**: Any explicit `.transport()` call or `.noDefaultTransport()` disables the default
- **Environment Control**: `MCPKIT_NO_DEFAULT_TRANSPORT=true` disables globally
- **Error Handling**: Graceful fallback with clear error messages if `@hexmcp/transport-stdio` is not available
- **Performance**: Minimal overhead - default transport logic only runs when needed

### 📖 Documentation

- **Migration Guide**: Comprehensive guide for adopting the new simplified API
- **Examples**: Updated all examples to demonstrate best practices
- **API Documentation**: Enhanced JSDoc with practical usage examples
- **README**: Updated quick start guide with simplified patterns

This enhancement makes MCP Kit more accessible to new developers while maintaining all the power and flexibility that advanced users expect.
