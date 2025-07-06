import { expectSuccess } from './error-assertions';
import type { JsonRpcRequest, JsonRpcResponse } from './types';

/**
 * MCP protocol version constants.
 */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

/**
 * Standard MCP methods as defined by the protocol specification.
 */
export const McpMethods = {
  // Lifecycle methods
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  SHUTDOWN: 'shutdown',

  // Tool methods
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',

  // Prompt methods
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',

  // Resource methods
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',

  // Notification methods
  NOTIFICATIONS_CANCELLED: 'notifications/cancelled',
  NOTIFICATIONS_PROGRESS: 'notifications/progress',
  NOTIFICATIONS_MESSAGE: 'notifications/message',
  NOTIFICATIONS_RESOURCES_UPDATED: 'notifications/resources/updated',
  NOTIFICATIONS_RESOURCES_LIST_CHANGED: 'notifications/resources/list_changed',
  NOTIFICATIONS_PROMPTS_LIST_CHANGED: 'notifications/prompts/list_changed',
  NOTIFICATIONS_TOOLS_LIST_CHANGED: 'notifications/tools/list_changed',
} as const;

/**
 * Type for MCP method names.
 */
export type McpMethod = (typeof McpMethods)[keyof typeof McpMethods];

/**
 * Validates that a JSON-RPC request follows the specification.
 */
export function validateRequest(request: JsonRpcRequest): void {
  if (request.jsonrpc !== '2.0') {
    throw new Error(`Invalid JSON-RPC version: expected "2.0", got "${request.jsonrpc}"`);
  }

  if (typeof request.method !== 'string' || request.method.length === 0) {
    throw new Error(`Invalid method: expected non-empty string, got ${typeof request.method}: "${request.method}"`);
  }

  // ID can be string, number, or null (for notifications)
  if (request.id !== null && typeof request.id !== 'string' && typeof request.id !== 'number') {
    throw new Error(`Invalid ID: expected string, number, or null, got ${typeof request.id}: ${request.id}`);
  }
}

/**
 * Validates that a JSON-RPC response follows the specification.
 */
export function validateResponse(response: JsonRpcResponse): void {
  if (response.jsonrpc !== '2.0') {
    throw new Error(`Invalid JSON-RPC version: expected "2.0", got "${response.jsonrpc}"`);
  }

  // Response must have either result OR error, never both
  const hasResult = response.result !== undefined;
  const hasError = response.error !== undefined;

  if (hasResult && hasError) {
    throw new Error('Response cannot have both result and error');
  }

  if (!hasResult && !hasError) {
    throw new Error('Response must have either result or error');
  }

  if (hasError && response.error) {
    validateError(response.error);
  }
}

/**
 * Validates that an error object follows the JSON-RPC specification.
 */
export function validateError(error: { code: number; message: string; data?: unknown }): void {
  if (typeof error.code !== 'number') {
    throw new Error(`Invalid error code: expected number, got ${typeof error.code}: ${error.code}`);
  }

  if (typeof error.message !== 'string') {
    throw new Error(`Invalid error message: expected string, got ${typeof error.message}: ${error.message}`);
  }

  if (error.message.length === 0) {
    throw new Error('Error message cannot be empty');
  }
}

/**
 * Validates that an initialize request follows MCP protocol.
 */
export function validateInitializeRequest(request: JsonRpcRequest): void {
  validateRequest(request);

  if (request.method !== McpMethods.INITIALIZE) {
    throw new Error(`Expected initialize method, got "${request.method}"`);
  }

  if (!request.params || typeof request.params !== 'object') {
    throw new Error('Initialize request must have params object');
  }

  const params = request.params as Record<string, unknown>;

  if (params.protocolVersion !== MCP_PROTOCOL_VERSION) {
    throw new Error(`Invalid protocol version: expected "${MCP_PROTOCOL_VERSION}", got "${params.protocolVersion}"`);
  }

  if (!params.capabilities || typeof params.capabilities !== 'object') {
    throw new Error('Initialize request must have capabilities object');
  }

  if (!params.clientInfo || typeof params.clientInfo !== 'object') {
    throw new Error('Initialize request must have clientInfo object');
  }

  const clientInfo = params.clientInfo as Record<string, unknown>;
  if (typeof clientInfo.name !== 'string') {
    throw new Error('clientInfo.name must be a string');
  }

  if (typeof clientInfo.version !== 'string') {
    throw new Error('clientInfo.version must be a string');
  }
}

/**
 * Validates that an initialize response follows MCP protocol.
 */
export function validateInitializeResponse(response: JsonRpcResponse): void {
  validateResponse(response);
  expectSuccess(response);

  const result = response.result as Record<string, unknown>;

  if (result.protocolVersion !== MCP_PROTOCOL_VERSION) {
    throw new Error(`Invalid protocol version in response: expected "${MCP_PROTOCOL_VERSION}", got "${result.protocolVersion}"`);
  }

  if (!result.capabilities || typeof result.capabilities !== 'object') {
    throw new Error('Initialize response must have capabilities object');
  }

  if (!result.serverInfo || typeof result.serverInfo !== 'object') {
    throw new Error('Initialize response must have serverInfo object');
  }

  const serverInfo = result.serverInfo as Record<string, unknown>;
  if (typeof serverInfo.name !== 'string') {
    throw new Error('serverInfo.name must be a string');
  }

  if (typeof serverInfo.version !== 'string') {
    throw new Error('serverInfo.version must be a string');
  }
}

/**
 * Validates that a tools/list response follows MCP protocol.
 */
export function validateToolsListResponse(response: JsonRpcResponse): void {
  validateResponse(response);
  expectSuccess(response);

  const result = response.result as Record<string, unknown>;

  if (!Array.isArray(result.tools)) {
    throw new Error('tools/list response must have tools array');
  }

  for (const tool of result.tools) {
    if (typeof tool.name !== 'string') {
      throw new Error('Tool name must be a string');
    }

    if (typeof tool.description !== 'string') {
      throw new Error('Tool description must be a string');
    }

    if (tool.inputSchema && typeof tool.inputSchema !== 'object') {
      throw new Error('Tool inputSchema must be an object if present');
    }
  }
}

/**
 * Validates that a tools/call request follows MCP protocol.
 */
export function validateToolsCallRequest(request: JsonRpcRequest): void {
  validateRequest(request);

  if (request.method !== McpMethods.TOOLS_CALL) {
    throw new Error(`Expected tools/call method, got "${request.method}"`);
  }

  const params = request.params as Record<string, unknown>;

  if (typeof params.name !== 'string') {
    throw new Error('tools/call request must have name string');
  }

  if (params.arguments && typeof params.arguments !== 'object') {
    throw new Error('tools/call arguments must be an object if present');
  }
}

/**
 * Validates that a tools/call response follows MCP protocol.
 */
export function validateToolsCallResponse(response: JsonRpcResponse): void {
  validateResponse(response);

  if (response.error) {
    return; // Error responses are valid
  }

  const result = response.result as Record<string, unknown>;

  if (!Array.isArray(result.content)) {
    throw new Error('tools/call response must have content array');
  }

  for (const content of result.content) {
    if (typeof content.type !== 'string') {
      throw new Error('Content item must have type string');
    }

    // Validate specific content types
    if (content.type === 'text' && typeof content.text !== 'string') {
      throw new Error('Text content must have text string');
    }

    if (content.type === 'image' && typeof content.data !== 'string') {
      throw new Error('Image content must have data string');
    }
  }
}

/**
 * Validates a complete request-response cycle.
 */
export function validateRequestResponseCycle(request: JsonRpcRequest, response: JsonRpcResponse): void {
  validateRequest(request);
  validateResponse(response);

  // Ensure response ID matches request ID (except for notifications)
  if (request.id !== null && response.id !== request.id) {
    throw new Error(`Response ID ${response.id} does not match request ID ${request.id}`);
  }
}

/**
 * Protocol compliance test framework for validating MCP implementations.
 * @deprecated Use individual functions instead
 */
export const ProtocolComplianceValidator = {
  validateRequest,
  validateResponse,
  validateError,
  validateInitializeRequest,
  validateInitializeResponse,
  validateToolsListResponse,
  validateToolsCallRequest,
  validateToolsCallResponse,
  validateRequestResponseCycle,
};

/**
 * Utility functions for protocol compliance testing.
 */
export const ProtocolTestUtils = {
  /**
   * Creates a valid initialize request for testing.
   */
  createInitializeRequest: (id: string | number = 1, clientName = 'Test Client', clientVersion = '1.0.0') => ({
    jsonrpc: '2.0' as const,
    id,
    method: McpMethods.INITIALIZE,
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { experimental: {} },
      clientInfo: {
        name: clientName,
        version: clientVersion,
      },
    },
  }),

  /**
   * Creates a valid initialize response for testing.
   */
  createInitializeResponse: (id: string | number = 1, serverName = 'Test Server', serverVersion = '1.0.0') => ({
    jsonrpc: '2.0' as const,
    id,
    result: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
      serverInfo: {
        name: serverName,
        version: serverVersion,
      },
    },
  }),

  /**
   * Creates a valid tools/call request for testing.
   */
  createToolsCallRequest: (id: string | number = 1, toolName = 'test-tool', args: Record<string, unknown> = {}) => ({
    jsonrpc: '2.0' as const,
    id,
    method: McpMethods.TOOLS_CALL,
    params: {
      name: toolName,
      arguments: args,
    },
  }),

  /**
   * Creates a valid tools/call response for testing.
   */
  createToolsCallResponse: (
    id: string | number = 1,
    content: Array<{ type: string; [key: string]: unknown }> = [{ type: 'text', text: 'Test result' }]
  ) => ({
    jsonrpc: '2.0' as const,
    id,
    result: {
      content,
    },
  }),

  validateRequestResponseCycle,
};
