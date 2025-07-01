export interface FixtureDefinition {
  name: string;
  description: string;
  category: FixtureCategory;
  input: FixtureInput;
  expected: FixtureExpected;
  metadata?: FixtureMetadata;
  version?: string;
  tags?: string[];
}

export enum FixtureCategory {
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  BASIC = 'basic',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  AUTH = 'auth',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  LIFECYCLE = 'lifecycle',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  STREAMING = 'streaming',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  REGISTRIES = 'registries',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  ERRORS = 'errors',
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enum values
  PERFORMANCE = 'performance',
}

export interface FixtureInput {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface FixtureExpected {
  type: FixtureExpectedType;
  response?: FixtureExpectedResponse;
  error?: FixtureExpectedError;
  stream?: FixtureExpectedStream;
  timeout?: number;
}

export type FixtureExpectedType = 'success' | 'error' | 'stream' | 'notification';

export interface FixtureExpectedResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
}

export interface FixtureExpectedError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface FixtureExpectedStream {
  chunks: unknown[];
  complete: boolean;
  progressNotifications?: FixtureProgressNotification[];
}

export interface FixtureProgressNotification {
  progressToken: string;
  progress: number;
  total: number;
}

export interface FixtureMetadata {
  requiresAuth?: boolean;
  lifecycleState?: FixtureLifecycleState;
  timeout?: number;
  tags?: string[];
  setup?: FixtureSetup;
  teardown?: FixtureTeardown;
  dependencies?: string[];
  skipReason?: string;
  environment?: FixtureEnvironment;
}

export type FixtureLifecycleState = 'idle' | 'initializing' | 'ready' | 'shutting-down';

export interface FixtureSetup {
  middleware?: string[];
  registries?: string[];
  capabilities?: Record<string, unknown>;
  state?: Record<string, unknown>;
}

export interface FixtureTeardown {
  cleanup?: boolean;
  resetState?: boolean;
}

export interface FixtureEnvironment {
  debugMode?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  variables?: Record<string, string>;
}
