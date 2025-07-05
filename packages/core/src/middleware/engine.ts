import { randomUUID } from 'node:crypto';
import type { Middleware, MiddlewareEngine, MiddlewareExecutionContext, MiddlewareExecutionOptions, RequestContext } from './types';
import { MiddlewareError, MiddlewareTimeoutError, ReentrantCallError } from './types';

/**
 * Middleware execution engine that implements the onion-style middleware pattern.
 *
 * The McpMiddlewareEngine executes middleware in an onion-like pattern where each middleware
 * can perform operations before and after calling the next middleware in the stack.
 * It provides comprehensive error handling, timeout management, re-entrant call detection,
 * and execution tracking for robust middleware orchestration.
 *
 * @example Basic middleware execution
 * ```typescript
 * const engine = new McpMiddlewareEngine();
 *
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   const loggerCtx = ctx as LoggerRequestContext;
 *   loggerCtx.log.info('Request started', {
 *     method: ctx.request.method,
 *     requestId: ctx.request.id
 *   });
 *   const start = Date.now();
 *
 *   await next(); // Execute next middleware
 *
 *   const duration = Date.now() - start;
 *   loggerCtx.log.info('Request completed', {
 *     method: ctx.request.method,
 *     requestId: ctx.request.id,
 *     durationMs: duration
 *   });
 * };
 *
 * const authMiddleware: Middleware = async (ctx, next) => {
 *   if (!ctx.state.user) {
 *     throw new Error('Authentication required');
 *   }
 *   await next();
 * };
 *
 * // Compose middleware stack (first registered = outermost layer)
 * const composedMiddleware = engine.applyMiddleware([
 *   loggingMiddleware,  // Executes first (outermost)
 *   authMiddleware     // Executes second (inner)
 * ]);
 *
 * // Execute with context
 * await composedMiddleware(requestContext, async () => {
 *   // Core business logic
 *   ctx.response = { id: ctx.request.id, result: 'success' };
 * });
 * ```
 *
 * @example Advanced execution with options
 * ```typescript
 * const engine = new McpMiddlewareEngine();
 *
 * await engine.executeMiddleware(
 *   requestContext,
 *   [middleware1, middleware2, middleware3],
 *   {
 *     timeout: 30000,    // 30 second timeout
 *     maxDepth: 50       // Maximum call depth
 *   }
 * );
 *
 * // Monitor active executions
 * const activeExecutions = engine.getActiveExecutions();
 * console.log(`${activeExecutions.size} middleware executions in progress`);
 * ```
 *
 * @example Error handling and re-entrant call detection
 * ```typescript
 * const problematicMiddleware: Middleware = async (ctx, next) => {
 *   // This would cause a re-entrant call error
 *   await next();
 *   await next(); // ERROR: Re-entrant call detected
 * };
 *
 * try {
 *   await engine.executeMiddleware(ctx, [problematicMiddleware]);
 * } catch (error) {
 *   if (error instanceof ReentrantCallError) {
 *     console.error('Re-entrant call detected:', error.message);
 *   } else if (error instanceof MiddlewareTimeoutError) {
 *     console.error('Middleware execution timed out:', error.message);
 *   } else if (error instanceof MiddlewareError) {
 *     console.error(`Middleware at index ${error.middlewareIndex} failed:`, error.message);
 *   }
 * }
 * ```
 */
export class McpMiddlewareEngine implements MiddlewareEngine {
  private readonly _activeExecutions = new Map<string, MiddlewareExecutionContext>();

  /**
   * Apply middleware stack and return a composed middleware function.
   *
   * Composes an array of middleware functions into a single middleware that executes
   * them in onion-style pattern. The first middleware in the array becomes the outermost
   * layer, and the last becomes the innermost layer before the final handler.
   *
   * @param stack - Array of middleware functions to compose
   * @returns A single composed middleware function
   *
   * @example
   * ```typescript
   * const engine = new McpMiddlewareEngine();
   *
   * const middleware1: Middleware = async (ctx, next) => {
   *   console.log('Before middleware 1');
   *   await next();
   *   console.log('After middleware 1');
   * };
   *
   * const middleware2: Middleware = async (ctx, next) => {
   *   console.log('Before middleware 2');
   *   await next();
   *   console.log('After middleware 2');
   * };
   *
   * const composed = engine.applyMiddleware([middleware1, middleware2]);
   *
   * // Execution order:
   * // "Before middleware 1"
   * // "Before middleware 2"
   * // [final handler executes]
   * // "After middleware 2"
   * // "After middleware 1"
   * ```
   */
  applyMiddleware(stack: Middleware[]): Middleware {
    if (stack.length === 0) {
      return async (_ctx: RequestContext, next: () => Promise<void>) => {
        await next();
      };
    }

    return async (ctx: RequestContext, next: () => Promise<void>) => {
      await this.executeMiddleware(ctx, [...stack, this._createFinalMiddleware(next)]);
    };
  }

  /**
   * Execute middleware stack with comprehensive error handling and monitoring.
   *
   * Executes the provided middleware array in sequence with advanced features including
   * timeout management, re-entrant call detection, maximum depth protection, and
   * execution tracking. Each execution is assigned a unique ID for monitoring.
   *
   * @param ctx - The request context to pass through the middleware stack
   * @param middleware - Array of middleware functions to execute
   * @param options - Optional execution configuration with timeout (default: 30000ms) and maxDepth (default: 100)
   * @throws \{MiddlewareTimeoutError\} When execution exceeds the timeout
   * @throws \{ReentrantCallError\} When re-entrant calls are detected
   * @throws \{MiddlewareError\} When any middleware in the stack fails
   *
   * @example Basic execution
   * ```typescript
   * const engine = new McpMiddlewareEngine();
   *
   * await engine.executeMiddleware(
   *   requestContext,
   *   [authMiddleware, loggingMiddleware, rateLimitMiddleware]
   * );
   * ```
   *
   * @example With custom options
   * ```typescript
   * await engine.executeMiddleware(
   *   requestContext,
   *   middlewareStack,
   *   {
   *     timeout: 60000,  // 1 minute timeout
   *     maxDepth: 200    // Allow deeper call stacks
   *   }
   * );
   * ```
   *
   * @example Error handling
   * ```typescript
   * try {
   *   await engine.executeMiddleware(ctx, middleware);
   * } catch (error) {
   *   if (error instanceof MiddlewareTimeoutError) {
   *     console.error(`Middleware timed out after ${error.timeout}ms`);
   *   } else if (error instanceof ReentrantCallError) {
   *     console.error(`Re-entrant call at index ${error.middlewareIndex}`);
   *   } else if (error instanceof MiddlewareError) {
   *     console.error(`Middleware failed at index ${error.middlewareIndex}: ${error.cause?.message}`);
   *   }
   * }
   * ```
   */
  async executeMiddleware(ctx: RequestContext, middleware: Middleware[], options?: MiddlewareExecutionOptions): Promise<void> {
    const executionId = randomUUID();
    const callStack = new Set<number>();
    const startTime = Date.now();
    const timeout = options?.timeout ?? 30000; // 30 second default timeout
    const maxDepth = options?.maxDepth ?? 100; // Maximum call depth
    let currentDepth = 0;

    const executionContext: MiddlewareExecutionContext = {
      isExecuting: true,
      currentIndex: 0,
      totalMiddleware: middleware.length,
      executionId,
    };

    this._activeExecutions.set(executionId, executionContext);

    try {
      const createNext = (index: number): (() => Promise<void>) => {
        return async () => {
          // Check execution timeout
          if (Date.now() - startTime > timeout) {
            throw new MiddlewareTimeoutError(timeout, index);
          }

          // Check call depth
          currentDepth++;
          if (currentDepth > maxDepth) {
            throw new Error(`Maximum call depth exceeded (${maxDepth}) at middleware index ${index}`);
          }

          if (index >= middleware.length) {
            currentDepth--;
            return;
          }

          if (callStack.has(index)) {
            throw new ReentrantCallError(executionId);
          }

          callStack.add(index);
          (executionContext as { currentIndex: number }).currentIndex = index;

          if (ctx.response) {
            callStack.delete(index);
            currentDepth--;
            return;
          }

          try {
            const currentMiddleware = middleware[index];
            if (currentMiddleware) {
              await currentMiddleware(ctx, createNext(index + 1));
            }
          } catch (error) {
            callStack.delete(index);
            currentDepth--;
            const middlewareError = error instanceof Error ? error : new Error(String(error));
            throw new MiddlewareError(`Middleware at index ${index} failed: ${middlewareError.message}`, index, middlewareError);
          }

          callStack.delete(index);
          currentDepth--;
        };
      };

      await createNext(0)();
    } catch (error) {
      this._activeExecutions.delete(executionId);
      throw error;
    }

    this._activeExecutions.delete(executionId);
  }

  getActiveExecutions(): Map<string, MiddlewareExecutionContext> {
    return new Map(this._activeExecutions);
  }

  isExecuting(executionId?: string): boolean {
    if (executionId) {
      return this._activeExecutions.has(executionId);
    }
    return this._activeExecutions.size > 0;
  }

  private _createFinalMiddleware(next: () => Promise<void>): Middleware {
    return async (_ctx: RequestContext, _next: () => Promise<void>) => {
      await next();
    };
  }
}

export { MiddlewareError, ReentrantCallError } from './types';
