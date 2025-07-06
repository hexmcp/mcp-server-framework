---
"@hexmcp/core": minor
---

Implement MCP-compliant tools/list response with JSON Schema

This release fixes a critical MCP protocol implementation gap where the framework was returning internal metadata format instead of the MCP-compliant format that clients expect.

**Key Changes:**

- **MCP Protocol Compliance**: The `tools/list` handler now returns proper MCP-compliant `Tool` objects with `inputSchema` as JSON Schema objects
- **JSON Schema Conversion**: Added utilities to convert `ToolParameter[]` and Zod schemas to JSON Schema format
- **New API Methods**: Added `ToolRegistry.listMcpTools()` method that returns MCP-compliant tool descriptions
- **Backward Compatibility**: Existing `ToolRegistry.list()` method continues to work for internal use
- **Type Safety**: Full TypeScript support with proper MCP protocol types from `@modelcontextprotocol/sdk`

**Technical Details:**

- Added `convertParametersToJsonSchema()` for converting tool parameters to JSON Schema
- Added `convertZodToJsonSchema()` using the official `zod-to-json-schema` package
- Added `convertToMcpTool()` to transform internal `ToolDefinition` to MCP `Tool` format
- Updated `tools/list` handler in server builder to use new MCP-compliant format
- Added comprehensive test coverage for all conversion scenarios

**Migration Guide:**

For most users, this change is transparent as the MCP protocol layer automatically uses the new compliant format. However, if you were directly using the `ToolRegistry.list()` method and expecting MCP-compliant output, you should now use `ToolRegistry.listMcpTools()` instead.

```typescript
// Before (returned internal metadata)
const tools = registry.list();

// After (returns MCP-compliant format)
const tools = registry.listMcpTools();
```

This fix resolves issues where MCP clients (like Augment) were rejecting servers due to missing or invalid `inputSchema` fields in tool descriptions.
