import type { InitializedNotification, InitializeRequest, InitializeResult } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import type { LifecycleManager } from './types';
import { AlreadyInitializedError, LifecycleViolationError } from './types';

/**
 * JSON-RPC error response structure
 */
interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC success response structure
 */
interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: T;
}

/**
 * MCP handshake handlers for initialize and shutdown requests
 */
export class McpHandshakeHandlers {
  private _lifecycleManager: LifecycleManager;

  constructor(lifecycleManager: LifecycleManager) {
    this._lifecycleManager = lifecycleManager;
  }

  /**
   * Handle initialize request from client
   */
  async handleInitialize(request: InitializeRequest & { id: string | number }): Promise<JsonRpcSuccess<InitializeResult> | JsonRpcError> {
    try {
      // Validate request structure
      if (!request.params) {
        return this._createErrorResponse(request.id, ErrorCode.InvalidParams, 'Missing required params in initialize request');
      }

      if (!request.params.protocolVersion) {
        return this._createErrorResponse(request.id, ErrorCode.InvalidParams, 'Missing required protocolVersion in initialize request');
      }

      if (!request.params.capabilities) {
        return this._createErrorResponse(request.id, ErrorCode.InvalidParams, 'Missing required capabilities in initialize request');
      }

      // Perform initialization through lifecycle manager
      const result = await this._lifecycleManager.initialize(request);

      return this._createSuccessResponse(request.id, result);
    } catch (error) {
      if (error instanceof AlreadyInitializedError) {
        return this._createErrorResponse(request.id, ErrorCode.InvalidRequest, error.message);
      }

      // Handle other initialization errors
      const message = error instanceof Error ? error.message : 'Initialization failed';
      return this._createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        message,
        error instanceof Error ? { stack: error.stack } : undefined
      );
    }
  }

  /**
   * Handle initialized notification from client
   */
  async handleInitialized(_notification: InitializedNotification): Promise<void> {
    // The initialized notification confirms that the client has received
    // the initialize response and is ready to proceed
    // This is primarily for logging/debugging purposes

    if (!this._lifecycleManager.isReady) {
      throw new LifecycleViolationError(
        this._lifecycleManager.currentState,
        'initialized notification',
        'Received initialized notification but server is not in ready state'
      );
    }

    // Notification processed successfully - no response needed
  }

  /**
   * Handle shutdown request (if implemented in future)
   * Note: The current MCP specification doesn't define a shutdown request,
   * but this provides a framework for future extension
   */
  async handleShutdown(request: { id: string | number; params?: { reason?: string } }): Promise<JsonRpcSuccess<null> | JsonRpcError> {
    try {
      const reason = request.params?.reason || 'Client requested shutdown';
      await this._lifecycleManager.shutdown(reason);

      return this._createSuccessResponse(request.id, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shutdown failed';
      return this._createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        message,
        error instanceof Error ? { stack: error.stack } : undefined
      );
    }
  }

  /**
   * Validate that a request can be processed in the current lifecycle state
   */
  validateRequest(method: string): void {
    this._lifecycleManager.validateOperation(method);
  }

  /**
   * Check if the server is ready to process operational requests
   */
  isReady(): boolean {
    return this._lifecycleManager.isReady;
  }

  /**
   * Check if the server has been initialized
   */
  isInitialized(): boolean {
    return this._lifecycleManager.isInitialized;
  }

  /**
   * Get current lifecycle state
   */
  getCurrentState(): string {
    return this._lifecycleManager.currentState;
  }

  /**
   * Create a JSON-RPC success response
   */
  private _createSuccessResponse<T>(id: string | number | null, result: T): JsonRpcSuccess<T> {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create a JSON-RPC error response
   */
  private _createErrorResponse(id: string | number | null, code: ErrorCode, message: string, data?: unknown): JsonRpcError {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Create error response for requests before initialization
   */
  createNotInitializedError(id: string | number | null, method: string): JsonRpcError {
    return this._createErrorResponse(
      id,
      ErrorCode.InvalidRequest,
      `Server not initialized. Cannot process '${method}' request before initialization.`
    );
  }

  /**
   * Create error response for invalid state operations
   */
  createInvalidStateError(id: string | number | null, method: string, currentState: string): JsonRpcError {
    return this._createErrorResponse(id, ErrorCode.InvalidRequest, `Operation '${method}' not allowed in state '${currentState}'`);
  }
}
