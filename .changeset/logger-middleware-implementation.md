---
"@hexmcp/core": minor
---

feat(core): implement logger middleware with ECS-style structured logging

Add comprehensive logger middleware with trace ID management, context injection, and structured logging capabilities:

**Core Features:**
- ECS-style structured JSON logging with traceId, method, transport, status, and durationMs fields
- Automatic trace ID generation and reuse across middleware chain
- Context logger injection via `ctx.log()` and `ctx.state.logger` with proper TypeScript types
- Debug mode support via `MCPKIT_DEBUG=1` environment variable
- PII-safe logging without request params or response data

**Logger Types:**
- `ContextLogger` interface for type-safe context logging methods
- `LoggerRequestContext` interface extending RequestContext with logger functionality
- `LoggerMiddlewareOptions` for middleware configuration

**Integration:**
- Builder pattern support via `builder.builtIn.logging(options)` API
- Compatible with Pino/Bunyan-style loggers through child logger support
- Graceful fallback to console logging when no custom logger provided

**Error Handling:**
- Proper RpcError code logging with structured error information
- Generic error handling with default -32000 error code
- Request duration tracking for performance monitoring

**Testing:**
- 97.87% test coverage with 31 comprehensive test cases
- Complete utility function testing including formatLogMetadata and createChildLogger
- Built-in middleware integration testing with custom and console loggers

This implementation provides production-ready structured logging for MCP servers with full TypeScript support and enterprise-grade test coverage.
