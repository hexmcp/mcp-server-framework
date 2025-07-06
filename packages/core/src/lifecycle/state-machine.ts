import { EventEmitter } from 'node:events';
import type { InitializeRequest, InitializeResult } from '@modelcontextprotocol/sdk/types.js';

import {
  AlreadyInitializedError,
  type CapabilityRegistry,
  type InitializationEvent,
  InvalidStateTransitionError,
  LifecycleEvent,
  type LifecycleManager,
  LifecycleState,
  LifecycleViolationError,
  NotInitializedError,
  type ShutdownEvent,
  type StateChangeEvent,
  VALID_TRANSITIONS,
} from './types';

/**
 * Core lifecycle state machine implementation for MCP servers
 *
 * Manages the server lifecycle according to the MCP protocol specification:
 * idle → initializing → ready → shutting-down → idle
 */
export class McpLifecycleManager extends EventEmitter implements LifecycleManager {
  private _currentState: LifecycleState = LifecycleState.IDLE;
  private _initializeRequest: InitializeRequest | null = null;
  private _initializeResult: InitializeResult | null = null;
  private _capabilityRegistry: CapabilityRegistry;
  private _hasBeenInitialized = false;

  constructor(capabilityRegistry: CapabilityRegistry) {
    super();
    this._capabilityRegistry = capabilityRegistry;
  }

  /**
   * Current lifecycle state
   */
  get currentState(): LifecycleState {
    return this._currentState;
  }

  /**
   * Whether the server has been initialized
   */
  get isInitialized(): boolean {
    return this._currentState !== LifecycleState.IDLE;
  }

  /**
   * Whether the server has ever been initialized (tracks initialization history)
   */
  get hasBeenInitialized(): boolean {
    return this._hasBeenInitialized;
  }

  /**
   * Whether the server is ready to process operational requests
   */
  get isReady(): boolean {
    return this._currentState === LifecycleState.READY;
  }

  /**
   * Get the initialization request if available
   */
  get initializeRequest(): InitializeRequest | null {
    return this._initializeRequest;
  }

  /**
   * Get the initialization result if available
   */
  get initializeResult(): InitializeResult | null {
    return this._initializeResult;
  }

  /**
   * Initialize the server with the given request
   */
  async initialize(request: InitializeRequest): Promise<InitializeResult> {
    if (this._currentState !== LifecycleState.IDLE) {
      throw new AlreadyInitializedError();
    }

    this._transitionTo(LifecycleState.INITIALIZING);
    this._initializeRequest = request;

    const initEvent: InitializationEvent = {
      state: this._currentState,
      timestamp: new Date(),
      initializeRequest: request,
    };
    this.emit(LifecycleEvent.INITIALIZATION_STARTED, initEvent);

    try {
      const result = await this._performInitialization(request);
      this._initializeResult = result;
      this._hasBeenInitialized = true;

      const completedEvent: InitializationEvent = {
        state: this._currentState,
        timestamp: new Date(),
        initializeRequest: request,
        initializeResult: result,
      };
      this.emit(LifecycleEvent.INITIALIZATION_COMPLETED, completedEvent);

      return result;
    } catch (error) {
      const failedEvent: InitializationEvent = {
        state: this._currentState,
        timestamp: new Date(),
        initializeRequest: request,
        error: error instanceof Error ? error : new Error(String(error)),
      };
      this.emit(LifecycleEvent.INITIALIZATION_FAILED, failedEvent);

      this._transitionTo(LifecycleState.IDLE);
      this._initializeRequest = null;

      throw error;
    }
  }

  /**
   * Handle the initialized notification to transition to ready state
   */
  async initialized(): Promise<void> {
    if (this._currentState !== LifecycleState.INITIALIZING) {
      throw new LifecycleViolationError(
        this._currentState,
        'initialized',
        'Initialized notification can only be sent when server is in initializing state'
      );
    }

    this._transitionTo(LifecycleState.READY);

    const readyEvent: InitializationEvent = {
      state: this._currentState,
      timestamp: new Date(),
      ...(this._initializeRequest && { initializeRequest: this._initializeRequest }),
      ...(this._initializeResult && { initializeResult: this._initializeResult }),
    };
    this.emit(LifecycleEvent.READY, readyEvent);
  }

  /**
   * Shutdown the server
   */
  async shutdown(reason?: string): Promise<void> {
    if (this._currentState === LifecycleState.IDLE) {
      return; // Already shut down
    }

    if (this._currentState === LifecycleState.SHUTTING_DOWN) {
      return; // Already shutting down
    }

    this._transitionTo(LifecycleState.SHUTTING_DOWN);

    const shutdownEvent: ShutdownEvent = {
      state: this._currentState,
      timestamp: new Date(),
      reason,
    };
    this.emit(LifecycleEvent.SHUTDOWN_STARTED, shutdownEvent);

    try {
      await this._performShutdown(reason);

      this._transitionTo(LifecycleState.IDLE);
      this._initializeRequest = null;
      this._initializeResult = null;

      const completedEvent: ShutdownEvent = {
        state: this._currentState,
        timestamp: new Date(),
        reason,
      };
      this.emit(LifecycleEvent.SHUTDOWN_COMPLETED, completedEvent);
    } catch (error) {
      const errorEvent: ShutdownEvent = {
        state: this._currentState,
        timestamp: new Date(),
        reason,
        error: error instanceof Error ? error : new Error(String(error)),
      };
      this.emit(LifecycleEvent.SHUTDOWN_COMPLETED, errorEvent);

      // Force transition to idle even on error
      this._transitionTo(LifecycleState.IDLE);
      this._initializeRequest = null;
      this._initializeResult = null;

      throw error;
    }
  }

  /**
   * Check if transition to the given state is valid
   */
  canTransitionTo(state: LifecycleState): boolean {
    const validNextStates = VALID_TRANSITIONS[this._currentState];
    return validNextStates.includes(state);
  }

  /**
   * Validate that an operation can be performed in the current state
   */
  validateOperation(operation: string): void {
    // Operations that are always allowed
    const alwaysAllowed = ['initialize', 'ping'];
    if (alwaysAllowed.includes(operation)) {
      return;
    }

    // Check for initialization requirement
    if (this._currentState === LifecycleState.IDLE) {
      throw new NotInitializedError(operation);
    }

    // Check for ready state requirement for operational requests
    const operationalRequests = [
      'prompts/list',
      'prompts/get',
      'tools/list',
      'tools/call',
      'resources/list',
      'resources/read',
      'resources/subscribe',
      'resources/unsubscribe',
      'completion/complete',
    ];

    if (operationalRequests.includes(operation) && this._currentState !== LifecycleState.READY) {
      throw new LifecycleViolationError(this._currentState, operation);
    }
  }

  /**
   * Perform the actual initialization logic
   */
  private async _performInitialization(request: InitializeRequest): Promise<InitializeResult> {
    const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];
    if (!supportedVersions.includes(request.params.protocolVersion)) {
      throw new Error(`Unsupported protocol version: ${request.params.protocolVersion}`);
    }

    if (request.params.capabilities) {
      this._capabilityRegistry.processClientCapabilities(request.params.capabilities);
    }

    const serverCapabilities = this._capabilityRegistry.getServerCapabilities();

    const result: InitializeResult = {
      protocolVersion: request.params.protocolVersion,
      capabilities: serverCapabilities,
      serverInfo: {
        name: 'MCP Server Framework',
        version: '1.0.0',
      },
    };

    return result;
  }

  /**
   * Perform the actual shutdown logic
   */
  private async _performShutdown(_reason?: string): Promise<void> {
    // Cleanup logic can be added here
    // For now, this is a no-op but provides extension point
  }

  /**
   * Internal method to transition between states
   */
  private _transitionTo(newState: LifecycleState): void {
    if (!this.canTransitionTo(newState)) {
      throw new InvalidStateTransitionError(this._currentState, newState);
    }

    const previousState = this._currentState;
    this._currentState = newState;

    const stateChangeEvent: StateChangeEvent = {
      previousState,
      currentState: newState,
      timestamp: new Date(),
    };

    this.emit(LifecycleEvent.STATE_CHANGED, stateChangeEvent);
  }
}
