---
"@hexmcp/core": minor
"@hexmcp/testing": minor
"@hexmcp/transport-stdio": patch
---

Implement MCP-compliant lifecycle management with comprehensive protocol validation

This release introduces significant improvements to MCP protocol compliance and lifecycle management:

**Core Package (@hexmcp/core):**
- Implement finite state machine for MCP lifecycle (idle→initializing→ready→shutting-down)
- Add MCP lifecycle state enforcement with proper error codes (-32002 for pre-initialization, -32003 for post-shutdown)
- Enhance handshake handlers with protocol compliance validation
- Improve request gate middleware for lifecycle state management
- Add comprehensive error handling and recovery mechanisms
- Update resource registry with better pattern matching capabilities
- **Fix validation error handling**: Tool validation errors now return proper tool results with `isError: true` instead of throwing exceptions that become generic `-32603 Internal error` responses
- **Fix streaming info middleware**: Properly detect stdio transport (including 'unknown' transport name from builder default) to prevent JSON-RPC protocol interference when sending info chunks
- **Improve tool result formatting**: Builder now correctly handles both validation error results and normal tool results without double-wrapping

**Testing Package (@hexmcp/testing):**
- Add protocol compliance validation utilities
- Introduce UUID generation utilities using the uuid package
- Enhance error assertion capabilities for MCP protocol testing
- Add comprehensive test factories for protocol validation scenarios
- **Add validation error tests**: Comprehensive test coverage for tool validation error handling including empty content, missing fields, invalid types, and custom validation functions
- **Add transport detection tests**: Tests for streaming info middleware transport detection including 'unknown' transport name handling

**Transport Stdio Package (@hexmcp/transport-stdio):**
- Update stdio transport for better MCP protocol compliance
- Improve error handling and lifecycle integration

**Documentation:**
- Enhanced README documentation with updated features and testing utilities
- Added silent mode configuration guidance
- Updated examples and usage patterns

**Bug Fixes:**
- **Validation Error Handling**: Fixed issue where tool validation errors (e.g., empty content, missing required fields) were returning generic `-32603 Internal error` instead of user-friendly validation messages
- **Line Breaks in Content**: Fixed issue where content with line breaks caused JSON-RPC protocol interference due to streaming info chunks being sent over stdio transport
- **Transport Detection**: Enhanced streaming info middleware to properly detect stdio transport including 'unknown' transport name used by builder default

These changes ensure full MCP protocol compliance while maintaining backward compatibility and improving the overall developer experience.
