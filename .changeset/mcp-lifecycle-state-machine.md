---
"@hexmcp/core": minor
---

Implement comprehensive MCP lifecycle state machine and handshake system

This release introduces a complete Model Context Protocol (MCP) lifecycle management system with strict protocol compliance:

**New Features:**
- Finite state machine with states: idle → initializing → ready → shutting-down
- Complete MCP handshake implementation with protocol version validation
- Request gating system preventing premature operational requests
- Dynamic capability management based on registered primitives
- Integration with @modelcontextprotocol/sdk for type safety and protocol compliance

**Key Components:**
- `McpLifecycleManager`: Core state machine with event emission
- `McpHandshakeHandlers`: Protocol-compliant initialize/shutdown handlers
- `McpRequestGate`: Dispatcher-level request validation
- `McpCapabilityRegistry`: Dynamic capability detection and management
- Comprehensive error handling with proper MCP error codes

**Protocol Support:**
- Multiple MCP protocol versions (2025-06-18, 2025-03-26, 2024-11-05)
- Proper capability negotiation during handshake
- State-aware request validation with appropriate MCP error codes (-32002, -32003, -32600)
- Graceful error recovery and state transitions
- Experimental capabilities support with dynamic configuration

**Quality Assurance:**
- 90 comprehensive tests covering edge cases and protocol scenarios
- Full TypeScript support with strict type checking
- Biome linting compliance
- Integration-ready design for transport and dispatcher layers

This implementation provides the foundation for building MCP-compliant servers with proper lifecycle management and protocol adherence.
