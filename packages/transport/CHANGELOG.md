# @hexmcp/transport

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

## 0.1.0

### Minor Changes

- becb1a3: Implement comprehensive ServerTransport interface system with registry and orchestration

  This release introduces a complete transport abstraction layer for the MCP server framework, providing clean separation between transport mechanisms and core server logic.

  ## New Features

  ### Core Transport Interface

  - `ServerTransport` interface with lifecycle methods (`start`, `stop`) and `name` property
  - `TransportDispatch` callback pattern for message handling with async response support
  - `TransportMetadata` interface for extensible request context (peer info, headers, etc.)
  - `TransportState` enum for transport lifecycle tracking

  ### MockTransport Implementation

  - Full `ServerTransport` implementation for testing and development
  - Configurable behavior: error simulation, delays, message capture
  - State management and response tracking capabilities
  - Comprehensive test utilities for transport development

  ### Transport Registry System

  - `TransportRegistry` class for centralized transport management
  - Set-based storage preventing duplicate registrations
  - Complete CRUD operations: register, unregister, clear, size, iteration
  - Type-safe operations with comprehensive error handling

  ### Transport Orchestration

  - `startAllTransports()` function for parallel transport startup
  - `stopAllTransports()` function for graceful shutdown coordination
  - "Continue on failure" strategy with detailed error aggregation
  - `TransportOrchestrationError` for structured failure reporting

  ## Architecture Benefits

  - **Transport Agnostic**: Clean abstraction supporting stdio, HTTP-SSE, WebSocket, etc.
  - **JSON-RPC Independent**: Uses existing `@hexmcp/codec-jsonrpc` package
  - **Future Ready**: Designed for integration with upcoming builder DSL pattern
  - **Error Resilient**: Comprehensive error handling and isolation
  - **Highly Testable**: 97.32% code coverage with 94 comprehensive tests

  ## Internal APIs

  Registry and orchestration functions are internal APIs, not exported from package index, preparing for future builder pattern integration:

  ```typescript
  // Future builder integration:
  // builder.transport(transport) -> registry.registerTransport(transport)
  // server.start() -> startAllTransports(registry, dispatch)
  // server.stop() -> stopAllTransports(registry)
  ```

  ## Breaking Changes

  None - this is a new package with no existing public API.

  ## Migration Guide

  This is a new package. Future transport implementations should implement the `ServerTransport` interface:

  ```typescript
  import type { ServerTransport, TransportDispatch } from "@hexmcp/transport";

  class MyTransport implements ServerTransport {
    readonly name = "my-transport";

    async start(dispatch: TransportDispatch): Promise<void> {
      // Initialize transport and set up message handling
    }

    async stop(): Promise<void> {
      // Clean shutdown logic
    }
  }
  ```
