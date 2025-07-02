import { encodeJsonRpcError, encodeJsonRpcSuccess, type JsonRpcRequest, RpcError } from '@hexmcp/codec-jsonrpc';
import type { ServerTransport } from '@hexmcp/transport';
import { McpMiddlewareEngine } from '../middleware/engine';
import type { Middleware, RequestContext } from '../middleware/types';
import { PromptRegistry, ResourceRegistry, ToolRegistry } from '../registries';
import type { HandlerContext, PromptDefinition, ResourceDefinition, ToolDefinition } from '../registries/types';
import type { InternalBuilderState, McpServerBuilder } from './types';

class McpServerBuilderImpl implements McpServerBuilder {
  private readonly state: InternalBuilderState;

  constructor() {
    this.state = {
      middleware: [],
      prompts: new Map<string, PromptDefinition>(),
      tools: new Map<string, ToolDefinition>(),
      resources: new Map<string, ResourceDefinition>(),
      transports: [],
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
    this.state.transports.push(transport);
    return this;
  }

  async listen(): Promise<void> {
    const dispatcher = this.buildDispatcher();

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
            case 'prompts/get': {
              const params = jsonRpcRequest.params as { name: string; arguments?: Record<string, unknown> };
              result = await promptRegistry.dispatch(params.name, params.arguments || {}, handlerContext);
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, {
                messages: [{ role: 'user', content: { type: 'text', text: String(result) } }],
              });
              break;
            }
            case 'tools/call': {
              const params = jsonRpcRequest.params as { name: string; arguments?: Record<string, unknown> };
              result = await toolRegistry.execute(params.name, params.arguments || {}, handlerContext);
              requestContext.response = encodeJsonRpcSuccess(jsonRpcRequest.id, {
                content: [{ type: 'text', text: JSON.stringify(result) }],
              });
              break;
            }
            case 'resources/read': {
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

export function createMcpKitServer(): McpServerBuilder {
  return new McpServerBuilderImpl();
}
