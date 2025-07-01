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
  constructor(executionId: string) {
    super(`Re-entrant call detected in middleware execution ${executionId}`);
    this.name = 'ReentrantCallError';
  }
}

export class MiddlewareTimeoutError extends Error {
  constructor(timeout: number, middlewareIndex: number) {
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
