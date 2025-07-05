import type { LifecycleManager, RequestGate } from './types';
import { AlreadyInitializedError, LifecycleViolationError, NotInitializedError, PostShutdownError } from './types';

/**
 * Request categories for lifecycle validation
 *
 * @internal
 */
enum RequestCategory {
  // biome-ignore lint/style/useNamingConvention: Request categories use SCREAMING_SNAKE_CASE
  INITIALIZATION = 'initialization',
  // biome-ignore lint/style/useNamingConvention: Request categories use SCREAMING_SNAKE_CASE
  OPERATIONAL = 'operational',
  // biome-ignore lint/style/useNamingConvention: Request categories use SCREAMING_SNAKE_CASE
  ALWAYS_ALLOWED = 'always_allowed',
}

/**
 * Request method categorization for lifecycle gating
 */
const REQUEST_CATEGORIES: Record<string, RequestCategory> = {
  // Initialization requests
  initialize: RequestCategory.INITIALIZATION,
  'notifications/initialized': RequestCategory.INITIALIZATION,

  // Always allowed requests (no lifecycle restrictions)
  ping: RequestCategory.ALWAYS_ALLOWED,
  'notifications/cancelled': RequestCategory.ALWAYS_ALLOWED,
  'notifications/progress': RequestCategory.ALWAYS_ALLOWED,

  // Operational requests (require ready state)
  'prompts/list': RequestCategory.OPERATIONAL,
  'prompts/get': RequestCategory.OPERATIONAL,
  'tools/list': RequestCategory.OPERATIONAL,
  'tools/call': RequestCategory.OPERATIONAL,
  'resources/list': RequestCategory.OPERATIONAL,
  'resources/read': RequestCategory.OPERATIONAL,
  'resources/subscribe': RequestCategory.OPERATIONAL,
  'resources/unsubscribe': RequestCategory.OPERATIONAL,
  'completion/complete': RequestCategory.OPERATIONAL,
  'logging/setLevel': RequestCategory.OPERATIONAL,

  // Resource change notifications (require ready state)
  'notifications/resources/list_changed': RequestCategory.OPERATIONAL,
  'notifications/resources/updated': RequestCategory.OPERATIONAL,
  'notifications/prompts/list_changed': RequestCategory.OPERATIONAL,
  'notifications/tools/list_changed': RequestCategory.OPERATIONAL,
};

/**
 * Implementation of request gating for MCP lifecycle compliance
 *
 * @internal
 */
export class McpRequestGate implements RequestGate {
  private _lifecycleManager: LifecycleManager;

  constructor(lifecycleManager: LifecycleManager) {
    this._lifecycleManager = lifecycleManager;
  }

  /**
   * Check if a request can be processed in the current lifecycle state
   */
  canProcessRequest(method: string): boolean {
    try {
      this.validateRequest(method);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate that a request can be processed, throwing appropriate errors
   */
  validateRequest(method: string): void {
    const category = this._getRequestCategory(method);

    switch (category) {
      case RequestCategory.ALWAYS_ALLOWED:
        return;

      case RequestCategory.INITIALIZATION:
        this._validateInitializationRequest(method);
        return;

      case RequestCategory.OPERATIONAL:
        this._validateOperationalRequest(method);
        return;

      default:
        this._validateOperationalRequest(method);
        return;
    }
  }

  /**
   * Get error response for invalid requests
   */
  getValidationError(method: string): {
    code: number;
    message: string;
    data?: unknown;
  } | null {
    try {
      this.validateRequest(method);
      return null;
    } catch (error) {
      if (error instanceof NotInitializedError) {
        return {
          code: error.code,
          message: error.message,
        };
      }

      if (error instanceof PostShutdownError) {
        return {
          code: error.code,
          message: error.message,
        };
      }

      if (error instanceof AlreadyInitializedError) {
        return {
          code: error.code,
          message: error.message,
        };
      }

      if (error instanceof LifecycleViolationError) {
        return {
          code: -32000, // Server error
          message: error.message,
          data: {
            currentState: error.currentState,
            operation: error.operation,
          },
        };
      }

      // Generic error
      return {
        code: -32603, // Internal error
        message: error instanceof Error ? error.message : 'Request validation failed',
      };
    }
  }

  /**
   * Add custom request category mapping
   */
  addRequestCategory(method: string, category: RequestCategory): void {
    REQUEST_CATEGORIES[method] = category;
  }

  /**
   * Get request category for debugging
   */
  getRequestCategory(method: string): string {
    return this._getRequestCategory(method);
  }

  /**
   * Get current lifecycle state for debugging
   */
  getCurrentState(): string {
    return this._lifecycleManager.currentState;
  }

  /**
   * Get request validation summary for debugging
   */
  getValidationSummary(): {
    currentState: string;
    isInitialized: boolean;
    isReady: boolean;
    allowedCategories: string[];
  } {
    const state = this._lifecycleManager.currentState;
    const isInitialized = this._lifecycleManager.isInitialized;
    const isReady = this._lifecycleManager.isReady;

    const allowedCategories = [RequestCategory.ALWAYS_ALLOWED];

    if (!isInitialized) {
      allowedCategories.push(RequestCategory.INITIALIZATION);
    }

    if (isReady) {
      allowedCategories.push(RequestCategory.OPERATIONAL);
    }

    return {
      currentState: state,
      isInitialized,
      isReady,
      allowedCategories,
    };
  }

  /**
   * Get the category for a request method
   */
  private _getRequestCategory(method: string): RequestCategory {
    return REQUEST_CATEGORIES[method] || RequestCategory.OPERATIONAL;
  }

  /**
   * Validate initialization requests
   */
  private _validateInitializationRequest(method: string): void {
    if (method === 'initialize') {
      if (this._lifecycleManager.isInitialized) {
        throw new AlreadyInitializedError();
      }
    } else if (method === 'notifications/initialized') {
      if (!this._lifecycleManager.isReady) {
        throw new LifecycleViolationError(
          this._lifecycleManager.currentState,
          method,
          'Initialized notification can only be sent when server is ready'
        );
      }
    }
  }

  /**
   * Validate operational requests
   */
  private _validateOperationalRequest(method: string): void {
    if (!this._lifecycleManager.isInitialized) {
      if (this._lifecycleManager.hasBeenInitialized) {
        throw new PostShutdownError(method);
      }
      throw new NotInitializedError(method);
    }

    if (!this._lifecycleManager.isReady) {
      throw new LifecycleViolationError(
        this._lifecycleManager.currentState,
        method,
        `Operational request '${method}' requires server to be in ready state`
      );
    }
  }
}

/**
 * Export request categories for external use
 *
 * @internal
 */
export { RequestCategory };
