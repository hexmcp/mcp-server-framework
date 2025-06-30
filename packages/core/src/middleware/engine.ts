import { randomUUID } from 'node:crypto';
import type { Middleware, MiddlewareEngine, MiddlewareExecutionContext, MiddlewareExecutionOptions, RequestContext } from './types';
import { MiddlewareError, MiddlewareTimeoutError, ReentrantCallError } from './types';

export class McpMiddlewareEngine implements MiddlewareEngine {
  private readonly _activeExecutions = new Map<string, MiddlewareExecutionContext>();

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
