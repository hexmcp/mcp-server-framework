# @hexmcp/transport

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
