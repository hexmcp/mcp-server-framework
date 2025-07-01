import type { Fixture, JsonRpcChunk, JsonRpcRequest, JsonRpcResponse } from './types';

/**
 * Builds a valid JSON-RPC 2.0 request for calling a tool handler.
 *
 * @param name - Name of the registered tool (e.g. "echo", "translate")
 * @param input - Input payload (object) matching the tool's Schema<I>
 * @param id - Optional ID (string or number); defaults to 1
 * @returns A JsonRpcRequest object with method "tools/call"
 */
export function createToolRequest(name: string, input: Record<string, unknown>, id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: input,
    },
  };
}

/**
 * Creates a prompt execution request for the given prompt name and input.
 *
 * @param name - Prompt name registered via builder.prompt()
 * @param input - Prompt input payload (object)
 * @param id - Optional ID; defaults to 1
 */
export function createPromptRequest(name: string, input: Record<string, unknown>, id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'prompts/get',
    params: {
      name,
      arguments: input,
    },
  };
}

/**
 * Creates a resource read request for the given resource URI.
 *
 * @param uri - Resource URI to read
 * @param id - Optional ID; defaults to 1
 */
export function createResourceRequest(uri: string, id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: {
      uri,
    },
  };
}

/**
 * Creates a tools/list request to enumerate available tools.
 *
 * @param id - Optional ID; defaults to 1
 */
export function createToolsListRequest(id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/list',
  };
}

/**
 * Creates a prompts/list request to enumerate available prompts.
 *
 * @param id - Optional ID; defaults to 1
 */
export function createPromptsListRequest(id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'prompts/list',
  };
}

/**
 * Creates a resources/list request to enumerate available resources.
 *
 * @param id - Optional ID; defaults to 1
 */
export function createResourcesListRequest(id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'resources/list',
  };
}

/**
 * Constructs a spec-compliant JSON-RPC error response.
 *
 * @param id - Request ID (from the original request)
 * @param code - JSON-RPC error code (e.g. -32601, -32000)
 * @param message - Human-readable error summary
 * @param data - Optional structured metadata (e.g. validation issues)
 */
export function createErrorResponse(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

/**
 * Creates a successful JSON-RPC response.
 *
 * @param id - Request ID (from the original request)
 * @param result - Success result data
 */
export function createSuccessResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Creates a sequence of `text`-type streaming output chunks.
 *
 * @param texts - Any number of string segments
 * @returns Array of chunks: [{ type: "text", content: ... }, ...]
 */
export function createStreamingChunks(...texts: string[]): JsonRpcChunk[] {
  return texts.map((text) => ({
    type: 'text',
    content: text,
  }));
}

/**
 * Creates an event-type streaming chunk.
 *
 * @param name - Event name
 * @param data - Event data payload
 */
export function createEventChunk(name: string, data?: unknown): JsonRpcChunk {
  return {
    type: 'event',
    name,
    ...(data !== undefined && { data }),
  };
}

/**
 * Creates an image-type streaming chunk.
 *
 * @param url - Image URL or data URI
 * @param alt - Optional alt text
 */
export function createImageChunk(url: string, alt?: string): JsonRpcChunk {
  return {
    type: 'image',
    url,
    ...(alt !== undefined && { alt }),
  };
}

/**
 * Wraps a request/response pair as a Fixture object for writing to disk or inline use.
 *
 * @param name - Unique descriptive name for the test case
 * @param input - JSON-RPC request object
 * @param expected - Expected response or streaming chunks
 * @returns Fixture object matching schema used in fixtures/
 */
export function createFixture(name: string, input: JsonRpcRequest, expected: JsonRpcResponse | JsonRpcChunk[]): Fixture {
  return {
    name,
    input,
    expected,
  };
}

/**
 * Common JSON-RPC error codes for convenience.
 */
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
  // MCP-specific error codes
  LIFECYCLE_ERROR: -32000,
  CAPABILITY_ERROR: -32001,
  AUTHORIZATION_ERROR: -32002,
} as const;

/**
 * Common lifecycle error for when server is not in ready state.
 */
export function createLifecycleError(id: string | number | null, operation: string, currentState = 'initializing'): JsonRpcResponse {
  return createErrorResponse(id, ErrorCodes.LIFECYCLE_ERROR, `Operational request '${operation}' requires server to be in ready state`, {
    currentState,
    operation,
  });
}
