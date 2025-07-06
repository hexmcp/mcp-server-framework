import { encodeJsonRpcError, encodeJsonRpcSuccess, type JsonRpcRequest, RpcError } from '@hexmcp/codec-jsonrpc';
import type { ServerTransport } from '@hexmcp/transport';
import { StdioTransport } from '@hexmcp/transport-stdio';
import type { InitializedNotification, InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpCapabilityRegistry, McpHandshakeHandlers, McpLifecycleManager, McpRequestGate, RegistryPrimitiveRegistry } from '../lifecycle';
import { McpMiddlewareEngine } from '../middleware/engine';
import type { Middleware, RequestContext } from '../middleware/types';
import { PromptRegistry, ResourceRegistry, ToolRegistry } from '../registries';
import type { HandlerContext, PromptDefinition, ResourceDefinition, ToolDefinition } from '../registries/types';
import type { InternalBuilderState, McpServerBuilder } from './types';

class McpServerBuilderImpl implements McpServerBuilder {
  private readonly state: InternalBuilderState;

  /**
   * Creates a new MCP server builder instance.
   *
   * Initializes the builder with default settings, including automatic StdioTransport
   * behavior unless disabled by the MCPKIT_NO_DEFAULT_TRANSPORT environment variable.
   */
  constructor() {
    this.state = {
      middleware: [],
      prompts: new Map<string, PromptDefinition>(),
      tools: new Map<string, ToolDefinition>(),
      resources: new Map<string, ResourceDefinition>(),
      transports: [],
      useDefaultStdioTransport: process.env.MCPKIT_NO_DEFAULT_TRANSPORT !== 'true',
    };
  }

  use(middleware: Middleware): McpServerBuilder;
  use(middleware: Middleware[]): McpServerBuilder;
  use(...middleware: Middleware[]): McpServerBuilder;
  use(middlewareOrArray: Middleware | Middleware[], ...additionalMiddleware: Middleware[]): McpServerBuilder {
    if (Array.isArray(middlewareOrArray)) {
      this.state.middleware.push(...middlewareOrArray);
    } else {
      this.state.middleware.push(middlewareOrArray);
    }

    if (additionalMiddleware.length > 0) {
      this.state.middleware.push(...additionalMiddleware);
    }

    return this;
  }

  prompt(name: string, definition: Omit<PromptDefinition, 'name'>): McpServerBuilder {
    const fullDefinition: PromptDefinition = {
      ...definition,
      name,
    };
    this.state.prompts.set(name, fullDefinition);
    return this;
  }

  tool(name: string, definition: Omit<ToolDefinition, 'name'>): McpServerBuilder {
    const fullDefinition: ToolDefinition = {
      ...definition,
      name,
    };
    this.state.tools.set(name, fullDefinition);
    return this;
  }

  resource(uriPattern: string, definition: Omit<ResourceDefinition, 'uriPattern'>): McpServerBuilder {
    const fullDefinition: ResourceDefinition = {
      ...definition,
      uriPattern,
    };
    this.state.resources.set(uriPattern, fullDefinition);
    return this;
  }

  transport(transport: ServerTransport): McpServerBuilder {
    this.state.useDefaultStdioTransport = false;
    this.state.transports.push(transport);
    return this;
  }

  noDefaultTransport(): McpServerBuilder {
    this.state.useDefaultStdioTransport = false;
    return this;
  }

  /**
   * Starts the server and begins listening for requests.
   *
   * This method builds the complete server configuration, initializes all
   * registered components, and starts all configured transport adapters.
   *
   * If no transports have been explicitly registered and the default transport
   * is enabled, a StdioTransport will be automatically added.
   *
   * @throws {Error} If the default StdioTransport cannot be loaded and no other transports are configured
   * @returns Promise that resolves when the server is ready to accept requests
   */
  async listen(): Promise<void> {
    const dispatcher = this.buildDispatcher();

    if (this.state.transports.length === 0 && this.state.useDefaultStdioTransport) {
      this.state.transports.push(new StdioTransport());
    }

    for (const transport of this.state.transports) {
      await transport.start(dispatcher);
    }
  }

  private buildDispatcher(): (request: unknown, respond: (response: unknown) => Promise<void>) => Promise<void> {
    const promptRegistry = new PromptRegistry();
    const toolRegistry = new ToolRegistry();
    const resourceRegistry = new ResourceRegistry();

    for (const [_name, definition] of this.state.prompts) {
      promptRegistry.register(definition);
    }

    for (const [_name, definition] of this.state.tools) {
      toolRegistry.register(definition);
    }

    for (const [_uriPattern, definition] of this.state.resources) {
      resourceRegistry.register(definition);
    }

    const primitiveRegistry = new RegistryPrimitiveRegistry(promptRegistry, toolRegistry, resourceRegistry);
    const capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);

    const lifecycleManager = new McpLifecycleManager(capabilityRegistry);
    const requestGate = new McpRequestGate(lifecycleManager);
    const handshakeHandlers = new McpHandshakeHandlers(lifecycleManager);

    const middlewareEngine = new McpMiddlewareEngine();
    const composedMiddleware = middlewareEngine.applyMiddleware(this.state.middleware);

    return async (request: unknown, respond: (response: unknown) => Promise<void>) => {
      try {
        const jsonRpcRequest = request as JsonRpcRequest;

        const requestContext: RequestContext = {
          request: jsonRpcRequest,
          send: respond,
          transport: { name: 'unknown' },
          state: {},
        };

        const coreHandler = async () => {
          const handlerContext: HandlerContext = {
            ...requestContext,
            execution: {
              executionId: `builder-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              startTime: new Date(),
              metadata: {},
            },
          };

          let result: unknown;

          switch (jsonRpcRequest.method) {
            case 'initialize': {
              const validationError = requestGate.getValidationError('initialize');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const initRequest = jsonRpcRequest as InitializeRequest & { id: string | number };
              const handshakeResult = await handshakeHandlers.handleInitialize(initRequest);
              requestContext.response = handshakeResult;
              break;
            }
            case 'notifications/initialized': {
              const notification = jsonRpcRequest as InitializedNotification;
              await handshakeHandlers.handleInitialized(notification);
              break;
            }
            case 'tools/list': {
              const validationError = requestGate.getValidationError('tools/list');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const tools = toolRegistry.listMcpTools();
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, { tools });
              break;
            }
            case 'resources/list': {
              const validationError = requestGate.getValidationError('resources/list');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const params = jsonRpcRequest.params as { cursor?: string } | undefined;
              const result = await resourceRegistry.list(params?.cursor, handlerContext);
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, result);
              break;
            }
            case 'prompts/list': {
              const validationError = requestGate.getValidationError('prompts/list');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const prompts = promptRegistry.list();
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, { prompts });
              break;
            }
            case 'shutdown': {
              const validationError = requestGate.getValidationError('shutdown');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const shutdownRequest = jsonRpcRequest as { id: string | number; params?: { reason?: string } };
              const shutdownResult = await handshakeHandlers.handleShutdown(shutdownRequest);
              requestContext.response = shutdownResult;
              break;
            }
            case 'prompts/get': {
              const validationError = requestGate.getValidationError('prompts/get');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const params = jsonRpcRequest.params as { name: string; arguments?: Record<string, unknown> };
              result = await promptRegistry.dispatch(params.name, params.arguments || {}, handlerContext);
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, {
                messages: [{ role: 'user', content: { type: 'text', text: String(result) } }],
              });
              break;
            }
            case 'tools/call': {
              const validationError = requestGate.getValidationError('tools/call');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const params = jsonRpcRequest.params as { name: string; arguments?: Record<string, unknown> };
              result = await toolRegistry.execute(params.name, params.arguments || {}, handlerContext);

              // If the result is already in tool result format (has content array and isError), return it directly
              if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content) && 'isError' in result) {
                requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, result);
              } else {
                // For other results, wrap them in the expected format
                requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, {
                  content: [{ type: 'text', text: JSON.stringify(result) }],
                });
              }
              break;
            }
            case 'resources/read': {
              const validationError = requestGate.getValidationError('resources/read');
              if (validationError) {
                requestContext.response = encodeJsonRpcError(
                  jsonRpcRequest.id,
                  new RpcError(validationError.code, validationError.message, validationError.data)
                );
                break;
              }
              const params = jsonRpcRequest.params as { uri: string };
              result = await resourceRegistry.get(params.uri, handlerContext);
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, {
                contents: [{ uri: params.uri, mimeType: 'application/json', text: JSON.stringify(result) }],
              });
              break;
            }
            default:
              requestContext.response = encodeJsonRpcError(jsonRpcRequest.id, new RpcError(-32601, 'Method not found'));
          }
        };

        await composedMiddleware(requestContext, coreHandler);

        if (requestContext.response) {
          await respond(requestContext.response);
        }
      } catch (error) {
        const jsonRpcRequest = request as JsonRpcRequest;
        await respond(
          encodeJsonRpcError(jsonRpcRequest.id, new RpcError(-32603, error instanceof Error ? error.message : 'Internal error'))
        );
      }
    };
  }
}

/**
 * Creates a new MCP Server Framework builder instance.
 *
 * This is the main entry point for creating MCP servers using the framework.
 * The builder provides a fluent API for configuring middleware, registering
 * prompts/tools/resources, and setting up transport adapters.
 *
 * ## Default Transport Behavior
 *
 * By default, if no explicit transports are registered, the server will automatically
 * add a StdioTransport when `listen()` is called. This simplifies the common case
 * of creating basic MCP servers that communicate over stdin/stdout.
 *
 * ## Transport Configuration Options
 *
 * 1. **Automatic (Default)**: No transport configuration needed
 * 2. **Explicit**: Use `.transport()` to add specific transports
 * 3. **Opt-out**: Use `.noDefaultTransport()` to disable automatic behavior
 * 4. **Environment**: Set `MCPKIT_NO_DEFAULT_TRANSPORT=true` to disable globally
 *
 * @example Basic usage with automatic StdioTransport
 * ```typescript
 * import { createMcpKitServer } from '@hexmcp/core';
 *
 * const server = createMcpKitServer()
 *   .tool('echo', {
 *     description: 'Echo back the input',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         message: { type: 'string' }
 *       }
 *     },
 *     handler: async ({ message }) => ({
 *       content: [{ type: 'text', text: message }]
 *     })
 *   })
 *   .listen(); // StdioTransport automatically added
 * ```
 *
 * @example Explicit transport configuration
 * ```typescript
 * import { createMcpKitServer } from '@hexmcp/core';
 * import { StdioTransport } from '@hexmcp/transport-stdio';
 *
 * const server = createMcpKitServer()
 *   .tool('echo', { description: 'Echo tool' })
 *   .transport(new StdioTransport()) // Explicit transport
 *   .listen();
 * ```
 *
 * @example Opt-out of default transport
 * ```typescript
 * import { createMcpKitServer } from '@hexmcp/core';
 * import { CustomTransport } from './custom-transport';
 *
 * const server = createMcpKitServer()
 *   .noDefaultTransport() // Disable automatic StdioTransport
 *   .transport(new CustomTransport())
 *   .listen();
 * ```
 *
 * @example Environment variable control
 * ```bash
 * # Disable default transport globally
 * MCPKIT_NO_DEFAULT_TRANSPORT=true node server.js
 * ```
 *
 * @returns A new MCP server builder instance
 * @public
 */
export function createMcpKitServer(): McpServerBuilder {
  return new McpServerBuilderImpl();
}
