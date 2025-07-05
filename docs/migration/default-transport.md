# Default Transport Migration Guide

This guide explains the new default transport behavior introduced in MCP Kit and how to migrate existing code.

## What Changed

Starting with this release, MCP Kit automatically adds a `StdioTransport` when no explicit transports are configured. This simplifies the common case of creating basic MCP servers.

### Before (Explicit Transport Required)

```typescript
import { createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

const server = createMcpKitServer()
  .tool('echo', {
    description: 'Echo tool',
    parameters: { type: 'object', properties: { message: { type: 'string' } } },
    handler: async ({ message }) => ({ content: [{ type: 'text', text: message }] })
  })
  .transport(new StdioTransport()) // Required
  .listen();
```

### After (Automatic Transport)

```typescript
import { createMcpKitServer } from '@hexmcp/core';

const server = createMcpKitServer()
  .tool('echo', {
    description: 'Echo tool',
    parameters: { type: 'object', properties: { message: { type: 'string' } } },
    handler: async ({ message }) => ({ content: [{ type: 'text', text: message }] })
  })
  .listen(); // StdioTransport automatically added
```

## Migration Options

### Option 1: No Changes Required (Recommended)

If your existing code uses explicit `StdioTransport`, it will continue to work unchanged:

```typescript
// This continues to work exactly as before
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new StdioTransport())
  .listen();
```

### Option 2: Simplify to Use Default Transport

Remove the explicit transport import and configuration:

```typescript
// Remove this import
// import { StdioTransport } from '@hexmcp/transport-stdio';

const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  // Remove this line
  // .transport(new StdioTransport())
  .listen();
```

### Option 3: Opt-Out of Default Behavior

If you need explicit control over transports:

```typescript
const server = createMcpKitServer()
  .noDefaultTransport() // Disable automatic transport
  .transport(new CustomTransport())
  .listen();
```

## Configuration Options

### Method-Based Control

```typescript
// Disable default transport for this server instance
const server = createMcpKitServer()
  .noDefaultTransport()
  .transport(new CustomTransport())
  .listen();
```

### Environment Variable Control

```bash
# Disable default transport globally
export MCPKIT_NO_DEFAULT_TRANSPORT=true
node server.js
```

```typescript
// Your server code remains unchanged
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .listen(); // No transport will be auto-added
```

## Common Migration Scenarios

### Scenario 1: Basic MCP Server

**Before:**
```typescript
import { createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

const server = createMcpKitServer()
  .tool('hello', { /* ... */ })
  .transport(new StdioTransport())
  .listen();
```

**After (Simplified):**
```typescript
import { createMcpKitServer } from '@hexmcp/core';

const server = createMcpKitServer()
  .tool('hello', { /* ... */ })
  .listen();
```

### Scenario 2: Multiple Transports

**Before:**
```typescript
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new StdioTransport())
  .transport(new HttpTransport())
  .listen();
```

**After (No Change Required):**
```typescript
// This continues to work unchanged
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new StdioTransport())
  .transport(new HttpTransport())
  .listen();
```

### Scenario 3: Custom Transport Only

**Before:**
```typescript
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new CustomTransport())
  .listen();
```

**After (No Change Required):**
```typescript
// This continues to work unchanged
const server = createMcpKitServer()
  .tool('example', { /* ... */ })
  .transport(new CustomTransport())
  .listen();
```

### Scenario 4: No Transports (Testing)

**Before:**
```typescript
const server = createMcpKitServer()
  .tool('example', { /* ... */ });
// No .listen() call for testing
```

**After (Add Opt-Out if Needed):**
```typescript
const server = createMcpKitServer()
  .noDefaultTransport() // Prevent auto-transport in tests
  .tool('example', { /* ... */ });
// No .listen() call for testing
```

## Troubleshooting

### Error: "Failed to load default StdioTransport"

This error occurs when the `@hexmcp/transport-stdio` package is not installed.

**Solution 1:** Install the package
```bash
npm install @hexmcp/transport-stdio
```

**Solution 2:** Use explicit transport configuration
```typescript
const server = createMcpKitServer()
  .noDefaultTransport()
  .transport(new YourCustomTransport())
  .listen();
```

**Solution 3:** Disable default transport globally
```bash
export MCPKIT_NO_DEFAULT_TRANSPORT=true
```

### Unexpected Transport Behavior

If you're experiencing unexpected transport behavior:

1. **Check for explicit transports:** Any explicit `.transport()` call disables the default
2. **Check environment variables:** `MCPKIT_NO_DEFAULT_TRANSPORT=true` disables the default
3. **Use `.noDefaultTransport()`:** For explicit control in your code

## Benefits of Migration

### For New Projects
- **Simpler Setup:** No need to import and configure StdioTransport
- **Less Boilerplate:** Fewer imports and configuration lines
- **Better Developer Experience:** Focus on business logic, not transport setup

### For Existing Projects
- **No Breaking Changes:** Existing code continues to work
- **Optional Simplification:** Can gradually adopt simpler patterns
- **Flexible Configuration:** Multiple ways to control behavior

## Best Practices

1. **New Projects:** Use the default transport behavior for simplicity
2. **Existing Projects:** Keep explicit configuration if it works
3. **Libraries:** Use `.noDefaultTransport()` for explicit control
4. **Testing:** Use environment variables or `.noDefaultTransport()` to disable auto-behavior
5. **Production:** Consider explicit configuration for clarity and control

---

*This migration is backward compatible. No immediate action is required for existing projects.*
