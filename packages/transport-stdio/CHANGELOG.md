# @hexmcp/transport-stdio

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
