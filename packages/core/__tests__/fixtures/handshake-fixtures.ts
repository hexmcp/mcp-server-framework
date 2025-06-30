import type {
  ClientCapabilities,
  InitializedNotification,
  InitializeRequest,
  InitializeResult,
  ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Test fixtures for MCP handshake scenarios
 */

export const VALID_CLIENT_CAPABILITIES: ClientCapabilities = {
  experimental: {},
  sampling: {},
};

export const VALID_SERVER_CAPABILITIES: ServerCapabilities = {
  experimental: {},
  logging: {},
  prompts: {},
  tools: {},
  resources: {
    subscribe: false,
    listChanged: false,
  },
};

export const MINIMAL_SERVER_CAPABILITIES: ServerCapabilities = {
  experimental: {},
  logging: {},
};

export const VALID_INITIALIZE_REQUEST: InitializeRequest = {
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: VALID_CLIENT_CAPABILITIES,
    clientInfo: {
      name: 'Test Client',
      version: '1.0.0',
    },
  },
};

export const VALID_INITIALIZE_REQUEST_WITH_ID = {
  ...VALID_INITIALIZE_REQUEST,
  id: 'test-init-1',
};

export const LEGACY_INITIALIZE_REQUEST: InitializeRequest = {
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: VALID_CLIENT_CAPABILITIES,
    clientInfo: {
      name: 'Legacy Client',
      version: '1.0.0',
    },
  },
};

export const INVALID_PROTOCOL_VERSION_REQUEST: InitializeRequest = {
  method: 'initialize',
  params: {
    protocolVersion: '2023-01-01',
    capabilities: VALID_CLIENT_CAPABILITIES,
    clientInfo: {
      name: 'Invalid Client',
      version: '1.0.0',
    },
  },
};

export const MISSING_PARAMS_REQUEST = {
  method: 'initialize',
  id: 'test-missing-params',
};

export const MISSING_PROTOCOL_VERSION_REQUEST = {
  method: 'initialize',
  id: 'test-missing-version',
  params: {
    capabilities: VALID_CLIENT_CAPABILITIES,
    clientInfo: {
      name: 'Missing Version Client',
      version: '1.0.0',
    },
  },
};

export const MISSING_CAPABILITIES_REQUEST = {
  method: 'initialize',
  id: 'test-missing-capabilities',
  params: {
    protocolVersion: '2025-06-18',
    clientInfo: {
      name: 'Missing Capabilities Client',
      version: '1.0.0',
    },
  },
};

export const VALID_INITIALIZED_NOTIFICATION: InitializedNotification = {
  method: 'notifications/initialized',
  params: {},
};

export const EXPECTED_INITIALIZE_RESULT: InitializeResult = {
  protocolVersion: '2025-06-18',
  capabilities: MINIMAL_SERVER_CAPABILITIES,
  serverInfo: {
    name: 'MCP Server Framework',
    version: '1.0.0',
  },
};

export const SHUTDOWN_REQUEST = {
  method: 'shutdown',
  id: 'test-shutdown-1',
  params: {
    reason: 'Test shutdown',
  },
};

export const SHUTDOWN_REQUEST_NO_REASON = {
  method: 'shutdown',
  id: 'test-shutdown-2',
  params: {},
};

/**
 * Operational request fixtures for testing lifecycle gating
 */
export const OPERATIONAL_REQUESTS = [
  { method: 'prompts/list', id: 'test-prompts-1' },
  { method: 'prompts/get', id: 'test-prompts-2', params: { name: 'test' } },
  { method: 'tools/list', id: 'test-tools-1' },
  { method: 'tools/call', id: 'test-tools-2', params: { name: 'test', arguments: {} } },
  { method: 'resources/list', id: 'test-resources-1' },
  { method: 'resources/read', id: 'test-resources-2', params: { uri: 'test://resource' } },
  {
    method: 'completion/complete',
    id: 'test-completion-1',
    params: { ref: { type: 'ref/prompt', name: 'test' }, argument: { name: 'test', value: 'test' } },
  },
];

export const ALWAYS_ALLOWED_REQUESTS = [
  { method: 'ping', id: 'test-ping-1' },
  { method: 'notifications/cancelled', params: { requestId: 'test-1' } },
  { method: 'notifications/progress', params: { progressToken: 'test-token', progress: 0.5 } },
];

/**
 * Error response fixtures
 */
export const EXPECTED_NOT_INITIALIZED_ERROR = {
  jsonrpc: '2.0',
  error: {
    code: -32600,
    message: "Server not initialized. Cannot process 'prompts/list' request before initialization.",
  },
};

export const EXPECTED_ALREADY_INITIALIZED_ERROR = {
  jsonrpc: '2.0',
  error: {
    code: -32600,
    message: 'Server already initialized. Cannot initialize again.',
  },
};

export const EXPECTED_INVALID_PARAMS_ERROR = {
  jsonrpc: '2.0',
  error: {
    code: -32602,
    message: 'Missing required params in initialize request',
  },
};

export const EXPECTED_UNSUPPORTED_VERSION_ERROR = {
  jsonrpc: '2.0',
  error: {
    code: -32603,
    message: 'Unsupported protocol version: 2023-01-01',
  },
};
