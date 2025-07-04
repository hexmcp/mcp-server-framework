# @hexmcp/transport-stdio

## 0.1.2

### Patch Changes

- 022afd2: Add transport-aware logging for stdio compatibility

  This change resolves the issue where console-based logging interferes with MCP client handshake over stdio transport by introducing transport-aware logger utilities and automatic logger selection.

  ## Core Package Changes

  ### New Logger Utilities

  - **`createStderrLogger()`**: Creates a logger that writes structured JSON logs to stderr only, safe for stdio transport
  - **`createSilentLogger()`**: Creates a no-op logger that discards all output, useful for completely disabling logging

  ### Enhanced Built-in Logging Middleware

  - **Automatic Transport Detection**: `createBuiltInLoggingMiddleware()` now automatically detects stdio transport and uses stderr-only logging
  - **Custom Logger Override**: When a custom logger is provided, it overrides automatic transport detection
  - **Backward Compatibility**: Existing usage continues to work unchanged

  ### Streaming Info Support

  - **`StreamingRequestContext`**: New interface extending `RequestContext` with optional `streamInfo` method
  - **`createStreamingInfoMiddleware()`**: Middleware that adds `streamInfo` method for client-visible progress updates
  - **Transport-Aware**: Only adds `streamInfo` for non-stdio transports to avoid protocol interference

  ## Transport-Stdio Package Changes

  ### Comprehensive Logging Compatibility Tests

  - Tests demonstrating stdout pollution problems with traditional logging
  - Tests showing safe stderr logging patterns
  - Tests verifying JSON-RPC protocol integrity with proper logging setup
  - Examples of correct logging patterns for stdio transport

  ## Usage Examples

  ### Automatic Transport-Aware Logging

  ```typescript
  const server = createMcpKitServer()
    .use(builtIn.logging()) // Automatically uses stderr for stdio transport
    .transport(new StdioTransport());
  ```

  ### Custom Logger with Stdio Safety

  ```typescript
  const server = createMcpKitServer()
    .use(
      builtIn.logging({
        logger: (level, message, data) => {
          // Safe for stdio - writes to stderr only
          const stderrLogger = createStderrLogger();
          stderrLogger.log(level, message, data);
        },
      })
    )
    .transport(new StdioTransport());
  ```

  ### Streaming Progress Updates

  ```typescript
  const server = createMcpKitServer()
    .use(createStreamingInfoMiddleware())
    .tool("process-data", {
      handler: async (args, ctx) => {
        const streamingCtx = ctx as StreamingRequestContext;
        streamingCtx.streamInfo?.("Processing started...");
        // ... processing logic
        streamingCtx.streamInfo?.("Processing completed");
        return result;
      },
    });
  ```

  ## Breaking Changes

  None. All changes are backward compatible.

  ## Migration Guide

  No migration required. Existing code will automatically benefit from transport-aware logging when using stdio transport.

## 0.1.1

### Patch Changes

- Fix CI/CD TypeScript compilation and improve development workflow

  ## 🔧 CI/CD Infrastructure Improvements

  - **Fixed TypeScript compilation errors in CI workflows** by adding build steps before type checking
  - **Enhanced GitHub Actions workflows** with proper package building to generate required type definitions
  - **Improved release workflow reliability** with consistent build process across CI and release pipelines
  - **Optimized fixture testing integration** with sequential execution using `--runInBand` for streaming test stability

  ## 🎯 Development Workflow Enhancements

  - **Added comprehensive Git hooks integration** for fixture testing in pre-push workflow
  - **Improved quality gate process** with proper execution order: lint → typecheck → test → test-fixtures
  - **Enhanced monorepo build system** with recursive package building via `pnpm -r build`
  - **Resolved Jest module resolution conflicts** by cleaning up duplicate build artifacts

  ## 🧪 Testing Infrastructure

  - **Integrated fixture testing into CI pipeline** with dedicated test step and proper error reporting
  - **Enhanced test fixture coverage system** with 100% acceptance criteria compliance
  - **Improved streaming test reliability** with sequential execution to prevent race conditions
  - **Optimized test execution performance** with proper build dependency management

  ## 🏗️ Build System Improvements

  - **Removed lodash dependencies** and migrated to Node.js built-in `util.isDeepStrictEqual` for better performance
  - **Fixed TypeScript strict mode compliance** with proper optional property handling
  - **Enhanced workspace dependency resolution** ensuring all packages build correctly in CI environments
  - **Improved package build consistency** across development and production environments

  These changes ensure reliable CI/CD operations, improve developer experience, and maintain high code quality standards across the entire MCP Server Framework ecosystem.

- Updated dependencies
  - @hexmcp/codec-jsonrpc@0.1.1
  - @hexmcp/transport@0.1.1

## 0.1.0

### Minor Changes

- 672155f: # feat(transport-stdio): implement NDJSON stdio transport for MCP framework

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
