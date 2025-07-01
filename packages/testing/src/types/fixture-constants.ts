import type { FixtureCategory, FixtureLifecycleState } from './fixture-types.js';

export const FIXTURE_CATEGORIES: Record<FixtureCategory, string> = {
  basic: 'Basic Protocol',
  auth: 'Authentication',
  lifecycle: 'Lifecycle Management',
  streaming: 'Streaming Responses',
  registries: 'Registry Integration',
  errors: 'Error Handling',
  performance: 'Performance & Edge Cases',
};

export const LIFECYCLE_STATES: Record<FixtureLifecycleState, string> = {
  idle: 'Idle (not initialized)',
  initializing: 'Initializing',
  ready: 'Ready (operational)',
  'shutting-down': 'Shutting Down',
};

export const COMMON_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  NOT_INITIALIZED: -32002,
  AFTER_SHUTDOWN: -32003,
  RATE_LIMIT: -32004,
  AUTHENTICATION_FAILED: -32000,
  AUTHORIZATION_FAILED: -32001,
} as const;

export const COMMON_METHODS = {
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  PING: 'ping',
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  LOGGING_SET_LEVEL: 'logging/setLevel',
  PROGRESS: 'notifications/progress',
  CANCELLED: 'notifications/cancelled',
} as const;

export const DEFAULT_TIMEOUT = 5000;
export const DEFAULT_STREAM_TIMEOUT = 10000;
export const DEFAULT_FIXTURE_VERSION = '1.0.0';

export const FIXTURE_FILE_EXTENSIONS = ['.json'] as const;
export const FIXTURE_ENCODING = 'utf-8' as const;
