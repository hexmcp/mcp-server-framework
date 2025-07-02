import type { JsonRpcRequest, JsonRpcResponse } from '@hexmcp/codec-jsonrpc';
import type { ServerTransport } from '@hexmcp/transport';
import type { Middleware } from '../middleware/types';
import type { PromptDefinition, ResourceDefinition, ToolDefinition } from '../registries/types';

export interface StreamingChunk {
  type: 'text' | 'image' | 'event' | 'error';
  [key: string]: unknown;
}

export interface McpServerBuilder {
  use(middleware: Middleware): McpServerBuilder;
  use(middleware: Middleware[]): McpServerBuilder;
  use(...middleware: Middleware[]): McpServerBuilder;

  prompt(name: string, definition: Omit<PromptDefinition, 'name'>): McpServerBuilder;

  tool(name: string, definition: Omit<ToolDefinition, 'name'>): McpServerBuilder;

  resource(uriPattern: string, definition: Omit<ResourceDefinition, 'uriPattern'>): McpServerBuilder;

  transport(transport: ServerTransport): McpServerBuilder;

  listen(): Promise<void>;
}

export interface InternalBuilderState {
  middleware: Middleware[];
  prompts: Map<string, PromptDefinition>;
  tools: Map<string, ToolDefinition>;
  resources: Map<string, ResourceDefinition>;
  transports: ServerTransport[];
}

export type DispatcherFn = (request: JsonRpcRequest) => Promise<JsonRpcResponse | StreamingChunk[]>;
