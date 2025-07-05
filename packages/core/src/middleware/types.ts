import type { JsonRpcRequest, JsonRpcResponse } from '@hexmcp/codec-jsonrpc';

/**
 * Request context passed through the middleware stack.
 *
 * The RequestContext contains all information about the current request being processed,
 * including the JSON-RPC request, response, transport details, and mutable state that
 * can be shared between middleware layers. This context is passed through the entire
 * middleware stack and can be modified by any middleware.
 *
 * @example Basic context usage in middleware
 * ```typescript
 * const authMiddleware: Middleware = async (ctx, next) => {
 *   // Read request information
 *   const { method, params } = ctx.request;
 *
 *   // Check authentication
 *   const token = params?.token;
 *   if (!token) {
 *     ctx.response = createErrorResponse(ctx.request.id, -32001, 'Authentication required');
 *     return; // Don't call next()
 *   }
 *
 *   // Add user info to state for downstream middleware
 *   ctx.state.user = await validateToken(token);
 *   ctx.state.authenticated = true;
 *
 *   await next(); // Continue to next middleware
 * };
 * ```
 *
 * @example State mutation across middleware
 * ```typescript
 * const tracingMiddleware: Middleware = async (ctx, next) => {
 *   // Add tracing information
 *   ctx.state.traceId = generateTraceId();
 *   ctx.state.startTime = Date.now();
 *
 *   await next();
 *
 *   // Calculate duration
 *   ctx.state.duration = Date.now() - ctx.state.startTime;
 * };
 *
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   await next();
 *
 *   // Access state from previous middleware and use structured logging
 *   const logger = ctx.logger; // Logger provided by middleware
 *   logger.info('Request completed', {
 *     traceId: ctx.state.traceId,
 *     durationMs: ctx.state.duration,
 *     method: ctx.request.method
 *   });
 * };
 * ```
 *
 * @example Transport-specific handling
 * ```typescript
 * const transportMiddleware: Middleware = async (ctx, next) => {
 *   console.log(`Request from ${ctx.transport.name} transport`);
 *
 *   if (ctx.transport.name === 'websocket') {
 *     // WebSocket-specific handling
 *     ctx.state.supportsStreaming = true;
 *   } else if (ctx.transport.name === 'stdio') {
 *     // STDIO-specific handling
 *     ctx.state.supportsStreaming = false;
 *   }
 *
 *   await next();
 * };
 * ```
 *
 * @example Response handling
 * ```typescript
 * const responseMiddleware: Middleware = async (ctx, next) => {
 *   await next();
 *
 *   // Modify response before sending
 *   if (ctx.response && 'result' in ctx.response) {
 *     ctx.response.result = {
 *       ...ctx.response.result,
 *       timestamp: new Date().toISOString(),
 *       requestId: ctx.state.traceId
 *     };
 *   }
 * };
 * ```
 */
export interface RequestContext {
  /** The incoming JSON-RPC request */
  request: JsonRpcRequest;

  /** The outgoing JSON-RPC response (set by middleware or core handler) */
  response?: JsonRpcResponse;

  /** Function to send messages back to the client (for streaming responses) */
  send: (message: unknown) => Promise<void>;

  /** Information about the transport that received this request */
  transport: {
    /** Name of the transport (e.g., 'stdio', 'websocket', 'http') */
    name: string;
    /** Optional peer information (IP address, connection details, etc.) */
    peer?: unknown;
  };

  /** Mutable state object shared between middleware layers */
  state: Record<string, unknown>;
}

/**
 * Extended request context with streaming info support for client-visible progress updates.
 *
 * This interface extends RequestContext with a streamInfo method that provides
 * a convenient way to send progress updates to clients via streaming transports.
 * The streamInfo method automatically formats messages as info chunks and only
 * sends them if the transport supports streaming.
 *
 * @example Using streamInfo in a tool handler
 * ```typescript
 * const toolHandler = async (args: unknown, ctx: StreamingRequestContext) => {
 *   ctx.streamInfo?.('Starting data processing...');
 *
 *   // Process data
 *   await processData(args);
 *   ctx.streamInfo?.('Data processing complete');
 *
 *   return { result: 'success' };
 * };
 * ```
 *
 * @example Middleware that adds streamInfo support
 * ```typescript
 * const streamingMiddleware: Middleware = async (ctx, next) => {
 *   const streamingCtx = ctx as StreamingRequestContext;
 *
 *   // Add streamInfo method if transport supports streaming
 *   if (ctx.transport.name !== 'stdio') {
 *     streamingCtx.streamInfo = async (text: string) => {
 *       await ctx.send({ type: 'info', text });
 *     };
 *   }
 *
 *   await next();
 * };
 * ```
 */
export interface StreamingRequestContext extends RequestContext {
  /**
   * Send an info message to the client for progress updates.
   *
   * This method is optional and may be undefined for transports that don't
   * support streaming (like stdio). Always check if the method exists before
   * calling it, or use optional chaining.
   *
   * @param text - The info message to send to the client
   * @returns Promise that resolves when the message is sent
   */
  streamInfo?: (text: string) => Promise<void>;
}

/**
 * Middleware function type for the onion-style middleware pattern.
 *
 * A middleware function receives the request context and a next function. It can perform
 * operations before calling next() (pre-processing), after calling next() (post-processing),
 * or both. The middleware can also choose not to call next() to short-circuit the execution.
 *
 * @param ctx - The request context containing request, response, transport info, and state
 * @param next - Function to call the next middleware in the stack
 * @returns Promise that resolves when the middleware completes
 *
 * @example Basic middleware structure
 * ```typescript
 * const exampleMiddleware: Middleware = async (ctx, next) => {
 *   // Pre-processing: runs before inner middleware
 *   console.log('Before processing request:', ctx.request.method);
 *
 *   try {
 *     await next(); // Call next middleware in stack
 *
 *     // Post-processing: runs after inner middleware
 *     console.log('After processing request:', ctx.response?.id);
 *   } catch (error) {
 *     // Error handling
 *     console.error('Request failed:', error);
 *     throw error; // Re-throw or handle as needed
 *   }
 * };
 * ```
 *
 * @example Authentication middleware
 * ```typescript
 * const authMiddleware: Middleware = async (ctx, next) => {
 *   const authHeader = ctx.request.params?.authorization;
 *
 *   if (!authHeader) {
 *     // Short-circuit: don't call next()
 *     ctx.response = createErrorResponse(ctx.request.id, -32001, 'Authentication required');
 *     return;
 *   }
 *
 *   // Add user to context
 *   ctx.state.user = await validateAuth(authHeader);
 *
 *   // Continue to next middleware
 *   await next();
 * };
 * ```
 *
 * @example Error handling middleware
 * ```typescript
 * const errorHandlerMiddleware: Middleware = async (ctx, next) => {
 *   try {
 *     await next();
 *   } catch (error) {
 *     // Convert errors to JSON-RPC error responses
 *     ctx.response = createErrorResponse(
 *       ctx.request.id,
 *       -32603,
 *       'Internal error',
 *       { message: error.message }
 *     );
 *   }
 * };
 * ```
 *
 * @example State mutation middleware
 * ```typescript
 * const tracingMiddleware: Middleware = async (ctx, next) => {
 *   // Add tracing info
 *   ctx.state.traceId = generateTraceId();
 *   ctx.state.startTime = performance.now();
 *
 *   await next();
 *
 *   // Calculate duration
 *   ctx.state.duration = performance.now() - ctx.state.startTime;
 *
 *   // Log trace info with structured logging
 *   const logger = ctx.logger; // Logger provided by middleware
 *   logger.info('Request trace completed', {
 *     traceId: ctx.state.traceId,
 *     durationMs: ctx.state.duration
 *   });
 * };
 * ```
 *
 * @example Advanced middleware composition patterns
 * ```typescript
 * // 1. Error handling with recovery
 * const resilientMiddleware: Middleware = async (ctx, next) => {
 *   const maxRetries = 3;
 *   let attempt = 0;
 *
 *   while (attempt < maxRetries) {
 *     try {
 *       await next();
 *       return; // Success, exit retry loop
 *     } catch (error) {
 *       attempt++;
 *       if (attempt >= maxRetries) {
 *         throw error; // Final attempt failed
 *       }
 *
 *       // Exponential backoff
 *       const delay = Math.pow(2, attempt) * 100;
 *       await new Promise(resolve => setTimeout(resolve, delay));
 *
 *       const logger = ctx.logger; // Logger provided by middleware
 *       logger.warn('Request retry attempted', {
 *         attempt,
 *         delayMs: delay,
 *         traceId: ctx.state.traceId
 *       });
 *     }
 *   }
 * };
 *
 * // 2. Conditional middleware execution
 * const conditionalMiddleware: Middleware = async (ctx, next) => {
 *   const shouldApplyMiddleware = ctx.request.method.startsWith('tools/');
 *
 *   if (shouldApplyMiddleware) {
 *     // Apply middleware logic only for tool requests
 *     ctx.state.toolRequest = true;
 *
 *     const logger = ctx.logger; // Logger provided by middleware
 *     logger.info('Tool request processing started', {
 *       method: ctx.request.method,
 *       traceId: ctx.state.traceId
 *     });
 *   }
 *
 *   await next();
 *
 *   if (shouldApplyMiddleware) {
 *     const logger = ctx.logger; // Logger provided by middleware
 *     logger.info('Tool request processing completed', {
 *       method: ctx.request.method,
 *       traceId: ctx.state.traceId
 *     });
 *   }
 * };
 *
 * // 3. Middleware with cleanup and resource management
 * const resourceMiddleware: Middleware = async (ctx, next) => {
 *   const resources: Array<() => Promise<void>> = [];
 *
 *   // Provide resource registration function
 *   ctx.state.addCleanup = (cleanup: () => Promise<void>) => {
 *     resources.push(cleanup);
 *   };
 *
 *   try {
 *     await next();
 *   } finally {
 *     // Always cleanup resources, even on error
 *     for (const cleanup of resources.reverse()) {
 *       try {
 *         await cleanup();
 *       } catch (cleanupError) {
 *         console.error('Cleanup failed:', cleanupError);
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @example Production-ready middleware stack composition
 * ```typescript
 * // Complete middleware stack for production use
 * const createProductionMiddlewareStack = (config: ProductionConfig): Middleware[] => {
 *   return [
 *     // 1. Error handling (outermost layer)
 *     createErrorMapperMiddleware({
 *       enableLogging: true,
 *       logLevel: 'error',
 *       includeStackTrace: config.debug,
 *       debugMode: config.debug
 *     }),
 *
 *     // 2. Request/response logging
 *     createLoggingMiddleware({
 *       level: config.logLevel,
 *       includeRequest: true,
 *       includeResponse: true,
 *       logger: config.logger
 *     }),
 *
 *     // 3. Security and authentication
 *     createAuthMiddleware({
 *       validateToken: config.auth.validateToken,
 *       requiredScopes: config.auth.requiredScopes
 *     }),
 *
 *     // 4. Rate limiting
 *     createRateLimitMiddleware({
 *       maxRequests: config.rateLimit.maxRequests,
 *       windowMs: config.rateLimit.windowMs,
 *       keyGenerator: (ctx) => ctx.state.user?.id || 'anonymous'
 *     }),
 *
 *     // 5. Request validation
 *     createValidationMiddleware({
 *       validateSchema: true,
 *       sanitizeInput: true
 *     }),
 *
 *     // 6. Performance monitoring
 *     createMetricsMiddleware({
 *       collectMetrics: config.metrics.enabled,
 *       metricsEndpoint: config.metrics.endpoint
 *     }),
 *
 *     // 7. Caching (if enabled)
 *     ...(config.cache.enabled ? [createCacheMiddleware(config.cache)] : []),
 *
 *     // 8. Business logic middleware (innermost layer)
 *     createBusinessLogicMiddleware()
 *   ];
 * };
 *
 * // Usage with middleware engine
 * const engine = new McpMiddlewareEngine();
 * const middlewareStack = createProductionMiddlewareStack(productionConfig);
 * const composedMiddleware = engine.applyMiddleware(middlewareStack);
 *
 * // Execute with request context
 * await composedMiddleware(requestContext, async () => {
 *   // Core business logic
 *   ctx.response = await handleRequest(ctx.request);
 * });
 * ```
 *
 * @see McpMiddlewareEngine For middleware execution and composition
 * @see RequestContext For context properties and state management
 */
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

/**
 * @internal
 */
export interface MiddlewareExecutionContext {
  readonly isExecuting: boolean;
  readonly currentIndex: number;
  readonly totalMiddleware: number;
  readonly executionId: string;
}

/**
 * @internal
 */
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

/**
 * @internal
 */
export class ReentrantCallError extends Error {
  constructor(public readonly executionId: string) {
    super(`Re-entrant call detected in middleware execution ${executionId}`);
    this.name = 'ReentrantCallError';
  }
}

/**
 * @internal
 */
export class MiddlewareTimeoutError extends Error {
  constructor(
    public readonly timeout: number,
    public readonly middlewareIndex: number
  ) {
    super(`Middleware at index ${middlewareIndex} timed out after ${timeout}ms`);
    this.name = 'MiddlewareTimeoutError';
  }
}

/**
 * @internal
 */
export enum MiddlewareExecutionState {
  Idle = 'idle',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * @internal
 */
export interface MiddlewareMetrics {
  executionTime: number;
  middlewareIndex: number;
  middlewareName?: string;
  success: boolean;
  error?: Error;
}

/**
 * @internal
 */
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
  logger?: Logger;
  logFormat?: 'json' | 'text';
  logFields?: LogFieldConfig;
  onError?: (error: unknown, ctx: RequestContext, mappedError: ErrorMappingResult) => void;
}

export interface Logger {
  error(message: string, meta?: LogEntry): void;
  warn(message: string, meta?: LogEntry): void;
  info(message: string, meta?: LogEntry): void;
  debug(message: string, meta?: LogEntry): void;
  log(level: LogLevel, message: string, meta?: LogEntry): void;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  error?: ErrorLogData;
  context?: RequestLogContext | undefined;
  metadata?: LogMetadata;
  stack?: string;
}

export interface ErrorLogData {
  classification: ErrorClassification;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  code: number;
  message: string;
  originalMessage: string;
  data?: unknown;
}

export interface RequestLogContext {
  requestId: string | number | null;
  method: string;
  transport: string;
  timestamp: number;
  middlewareIndex?: number;
  executionId?: string;
  peer?: unknown;
}

export interface LogMetadata {
  source: 'error-mapper';
  version: string;
  environment: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
}

export interface LogFieldConfig {
  includeTimestamp?: boolean;
  includeLevel?: boolean;
  includeSource?: boolean;
  includeCorrelationId?: boolean;
  includeTraceId?: boolean;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  customFields?: Record<string, unknown>;
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
