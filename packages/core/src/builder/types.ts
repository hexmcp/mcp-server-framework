import type { JsonRpcRequest, JsonRpcResponse } from '@hexmcp/codec-jsonrpc';
import type { ServerTransport } from '@hexmcp/transport';
import type { Middleware } from '../middleware/types';
import type { PromptDefinition, ResourceDefinition, ToolDefinition } from '../registries/types';

export interface StreamingChunk {
  type: 'text' | 'image' | 'event' | 'error';
  [key: string]: unknown;
}

/**
 * Fluent builder interface for configuring and creating MCP servers.
 *
 * Provides a chainable API for registering middleware, prompts, tools, resources,
 * and transport adapters. The builder pattern ensures type safety and makes
 * server configuration intuitive and discoverable.
 *
 * @public
 */
export interface McpServerBuilder {
  /**
   * Registers middleware with the server.
   *
   * Middleware is executed in registration order using an onion-style pattern.
   * Each middleware can modify the request context, handle errors, and control
   * the execution flow.
   *
   * @param middleware - Single middleware function or array of middleware
   * @returns The builder instance for chaining
   */
  use(middleware: Middleware): McpServerBuilder;
  use(middleware: Middleware[]): McpServerBuilder;
  use(...middleware: Middleware[]): McpServerBuilder;

  /**
   * Registers a prompt with the server.
   *
   * Prompts are templates that can be filled with dynamic content and used
   * by clients to generate structured requests.
   *
   * @param name - Unique identifier for the prompt
   * @param definition - Prompt configuration excluding the name
   * @returns The builder instance for chaining
   */
  prompt(name: string, definition: Omit<PromptDefinition, 'name'>): McpServerBuilder;

  /**
   * Registers a tool with the server.
   *
   * Tools are functions that clients can call to perform specific operations.
   * Each tool has a schema defining its parameters and a handler function.
   *
   * @param name - Unique identifier for the tool
   * @param definition - Tool configuration excluding the name
   * @returns The builder instance for chaining
   */
  tool(name: string, definition: Omit<ToolDefinition, 'name'>): McpServerBuilder;

  /**
   * Registers a resource with the server.
   *
   * Resources are data sources that clients can read from. They are identified
   * by URI patterns and can provide static or dynamic content.
   *
   * @param uriPattern - URI pattern that identifies this resource
   * @param definition - Resource configuration excluding the URI pattern
   * @returns The builder instance for chaining
   */
  resource(uriPattern: string, definition: Omit<ResourceDefinition, 'uriPattern'>): McpServerBuilder;

  /**
   * Adds a transport adapter to the server.
   *
   * Transport adapters handle the communication layer between the server and
   * clients. Multiple transports can be registered for different protocols.
   *
   * @param transport - Transport adapter instance
   * @returns The builder instance for chaining
   */
  transport(transport: ServerTransport): McpServerBuilder;

  /**
   * Disables the default stdio transport.
   *
   * Use this when you want to configure transports manually without
   * the automatic stdio transport being added. This is useful for
   * servers that need custom transport configurations or multiple
   * transports.
   *
   * @returns The builder instance for chaining
   * @example
   * ```typescript
   * const server = createMcpKitServer()
   *   .noDefaultTransport()
   *   .transport(new CustomTransport())
   *   .listen();
   * ```
   */
  noDefaultTransport(): McpServerBuilder;

  /**
   * Starts the server and begins listening for requests.
   *
   * This method builds the complete server configuration, initializes all
   * registered components, and starts all configured transport adapters.
   * If no transports have been explicitly registered, a default StdioTransport
   * will be automatically added.
   *
   * @returns Promise that resolves when the server is ready to accept requests
   */
  listen(): Promise<void>;
}

/**
 * Internal state management for the MCP server builder.
 *
 * @internal
 */
export interface InternalBuilderState {
  middleware: Middleware[];
  prompts: Map<string, PromptDefinition>;
  tools: Map<string, ToolDefinition>;
  resources: Map<string, ResourceDefinition>;
  transports: ServerTransport[];
  useDefaultStdioTransport: boolean;
}

export type DispatcherFn = (request: JsonRpcRequest) => Promise<JsonRpcResponse | StreamingChunk[]>;
