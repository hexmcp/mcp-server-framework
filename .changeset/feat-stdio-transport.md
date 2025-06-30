---
'@hexmcp/transport-stdio': minor
---

# feat(transport-stdio): implement NDJSON stdio transport for MCP framework

Add new **@hexmcp/transport-stdio** package providing JSON-RPC 2.0 communication over stdin/stdout using NDJSON format. This transport implementation enables MCP servers to communicate through standard input/output streams with proper message framing and error handling.

## Key Features

- **STDIO Communication**: JSON-RPC 2.0 over NDJSON protocol for reliable message framing
- **High Performance**: Efficient readline-based message processing with immediate stdout responses
- **Error Handling**: Comprehensive error handling with proper JSON-RPC error responses
- **Lifecycle Management**: Graceful start/stop with idempotent methods and cleanup
- **Transport Integration**: Compatible with transport registry for multi-transport server setups
- **Well Tested**: 80%+ test coverage with comprehensive mocked stdin/stdout testing
- **Clean Design**: Stateless implementation following established transport interface patterns

## Impact

This package complements the existing transport system and provides a **standard way for MCP servers to communicate via stdio**, which is commonly used in language server protocols and similar applications. It enables seamless integration with tools and editors that expect stdio-based communication.
