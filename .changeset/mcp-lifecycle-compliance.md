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

**Testing Package (@hexmcp/testing):**
- Add protocol compliance validation utilities
- Introduce UUID generation utilities using the uuid package
- Enhance error assertion capabilities for MCP protocol testing
- Add comprehensive test factories for protocol validation scenarios

**Transport Stdio Package (@hexmcp/transport-stdio):**
- Update stdio transport for better MCP protocol compliance
- Improve error handling and lifecycle integration

**Documentation:**
- Enhanced README documentation with updated features and testing utilities
- Added silent mode configuration guidance
- Updated examples and usage patterns

These changes ensure full MCP protocol compliance while maintaining backward compatibility and improving the overall developer experience.
