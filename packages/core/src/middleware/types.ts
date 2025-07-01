import type { JsonRpcRequest, JsonRpcResponse } from '@hexmcp/codec-jsonrpc';

export interface RequestContext {
  request: JsonRpcRequest;
  response?: JsonRpcResponse;
  send: (message: unknown) => Promise<void>;
  transport: {
    name: string;
    peer?: unknown;
  };
  state: Record<string, unknown>;
}

export type Middleware = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

export interface MiddlewareRegistry {
  registerMiddleware(middleware: Middleware): void;
  getMiddlewareStack(): Middleware[];
  clear(): void;
  size(): number;
  isEmpty(): boolean;
}

export interface MiddlewareExecutionOptions {
  timeout?: number;
  maxDepth?: number;
}

export interface MiddlewareEngine {
  applyMiddleware(stack: Middleware[]): Middleware;
  executeMiddleware(ctx: RequestContext, middleware: Middleware[], options?: MiddlewareExecutionOptions): Promise<void>;
}

export interface MiddlewareExecutionContext {
  readonly isExecuting: boolean;
  readonly currentIndex: number;
  readonly totalMiddleware: number;
  readonly executionId: string;
}

export class MiddlewareError extends Error {
  constructor(
    message: string,
    public readonly middlewareIndex: number,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'MiddlewareError';
  }
}

export class ReentrantCallError extends Error {
  constructor(public readonly executionId: string) {
    super(`Re-entrant call detected in middleware execution ${executionId}`);
    this.name = 'ReentrantCallError';
  }
}

export class MiddlewareTimeoutError extends Error {
  constructor(
    public readonly timeout: number,
    public readonly middlewareIndex: number
  ) {
    super(`Middleware at index ${middlewareIndex} timed out after ${timeout}ms`);
    this.name = 'MiddlewareTimeoutError';
  }
}

export enum MiddlewareExecutionState {
  Idle = 'idle',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
}

export interface MiddlewareMetrics {
  executionTime: number;
  middlewareIndex: number;
  middlewareName?: string;
  success: boolean;
  error?: Error;
}

export interface MiddlewareExecutionResult {
  state: MiddlewareExecutionState;
  metrics: MiddlewareMetrics[];
  totalExecutionTime: number;
  error?: Error;
  shortCircuited: boolean;
  responseSet: boolean;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface ErrorMapperOptions {
  debugMode?: boolean;
  enableLogging?: boolean;
  logLevel?: LogLevel;
  customErrorMapper?: (error: unknown, ctx: RequestContext) => ErrorMappingResult;
  includeStackTrace?: boolean;
  includeRequestContext?: boolean;
  onError?: (error: unknown, ctx: RequestContext, mappedError: ErrorMappingResult) => void;
}

export interface ErrorContext {
  originalError: unknown;
  errorType: string;
  timestamp: number;
  requestId: string | number | null;
  method: string;
  transportName: string;
  executionId?: string;
  middlewareStack?: string[];
}

export interface ErrorMappingResult {
  code: number;
  message: string;
  data?: unknown;
}

export type ErrorMapper = (error: unknown, ctx: RequestContext) => ErrorMappingResult;

export enum ErrorClassification {
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  RPC_ERROR = 'rpc_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  MIDDLEWARE_ERROR = 'middleware_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  MIDDLEWARE_TIMEOUT = 'middleware_timeout',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  REENTRANT_CALL = 'reentrant_call',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  VALIDATION_ERROR = 'validation_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  AUTHENTICATION_ERROR = 'authentication_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  AUTHORIZATION_ERROR = 'authorization_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  RATE_LIMIT_ERROR = 'rate_limit_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  TIMEOUT_ERROR = 'timeout_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  NETWORK_ERROR = 'network_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  PARSE_ERROR = 'parse_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  STANDARD_ERROR = 'standard_error',
  // biome-ignore lint/style/useNamingConvention: Error classification uses SCREAMING_SNAKE_CASE
  UNKNOWN_ERROR = 'unknown_error',
}

export interface ErrorClassificationResult {
  classification: ErrorClassification;
  code: number;
  message: string;
  preserveOriginalMessage: boolean;
  includeDebugInfo: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorMetadata {
  classification: ErrorClassification;
  originalType: string;
  timestamp: number;
  middlewareIndex?: number;
  executionId?: string;
  stackTrace?: string;
  additionalData?: Record<string, unknown>;
}
