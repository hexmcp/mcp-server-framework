import type { ClientCapabilities, InitializeRequest, InitializeResult, ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP server lifecycle states following the protocol specification
 */
export enum LifecycleState {
  // biome-ignore lint/style/useNamingConvention: MCP protocol uses SCREAMING_SNAKE_CASE
  IDLE = 'idle',
  // biome-ignore lint/style/useNamingConvention: MCP protocol uses SCREAMING_SNAKE_CASE
  INITIALIZING = 'initializing',
  // biome-ignore lint/style/useNamingConvention: MCP protocol uses SCREAMING_SNAKE_CASE
  READY = 'ready',
  // biome-ignore lint/style/useNamingConvention: MCP protocol uses SCREAMING_SNAKE_CASE
  SHUTTING_DOWN = 'shutting-down',
}

/**
 * Valid state transitions in the MCP lifecycle
 *
 * @internal
 */
export const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  [LifecycleState.IDLE]: [LifecycleState.INITIALIZING],
  [LifecycleState.INITIALIZING]: [LifecycleState.READY, LifecycleState.SHUTTING_DOWN, LifecycleState.IDLE],
  [LifecycleState.READY]: [LifecycleState.SHUTTING_DOWN],
  [LifecycleState.SHUTTING_DOWN]: [LifecycleState.IDLE],
};

/**
 * Events emitted during lifecycle state transitions
 */
export enum LifecycleEvent {
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  STATE_CHANGED = 'state-changed',
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  INITIALIZATION_STARTED = 'initialization-started',
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  INITIALIZATION_COMPLETED = 'initialization-completed',
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  INITIALIZATION_FAILED = 'initialization-failed',
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  SHUTDOWN_STARTED = 'shutdown-started',
  // biome-ignore lint/style/useNamingConvention: Event names use SCREAMING_SNAKE_CASE
  SHUTDOWN_COMPLETED = 'shutdown-completed',
}

/**
 * Event data for state change events
 */
export interface StateChangeEvent {
  previousState: LifecycleState;
  currentState: LifecycleState;
  timestamp: Date;
}

/**
 * Event data for initialization events
 */
export interface InitializationEvent {
  state: LifecycleState;
  timestamp: Date;
  initializeRequest?: InitializeRequest;
  initializeResult?: InitializeResult;
  error?: Error;
}

/**
 * Event data for shutdown events
 */
export interface ShutdownEvent {
  state: LifecycleState;
  timestamp: Date;
  reason?: string | undefined;
  error?: Error;
}

/**
 * Custom error for invalid state transitions
 *
 * @internal
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly fromState: LifecycleState,
    public readonly toState: LifecycleState,
    message?: string
  ) {
    super(message || `Invalid transition from ${fromState} to ${toState}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Custom error for lifecycle violations
 *
 * @internal
 */
export class LifecycleViolationError extends Error {
  constructor(
    public readonly currentState: LifecycleState,
    public readonly operation: string,
    message?: string
  ) {
    super(message || `Operation '${operation}' not allowed in state '${currentState}'`);
    this.name = 'LifecycleViolationError';
  }
}

/**
 * MCP protocol error for requests before initialization
 */
export class NotInitializedError extends Error {
  public readonly code = -32002;

  constructor(method: string) {
    super(`Server not initialized. Cannot process '${method}' request before initialization.`);
    this.name = 'NotInitializedError';
  }
}

/**
 * MCP protocol error for duplicate initialization
 *
 * @internal
 */
export class AlreadyInitializedError extends Error {
  public readonly code = ErrorCode.InvalidRequest;

  constructor() {
    super('Server already initialized. Cannot initialize again.');
    this.name = 'AlreadyInitializedError';
  }
}

/**
 * MCP protocol error for requests after shutdown
 */
export class PostShutdownError extends Error {
  public readonly code = -32003;

  constructor(method: string) {
    super(`Server has been shut down. Cannot process '${method}' request after shutdown.`);
    this.name = 'PostShutdownError';
  }
}

/**
 * Capability registry interface for dynamic capability management
 */
export interface CapabilityRegistry {
  getServerCapabilities(): ServerCapabilities;
  updateCapabilities(capabilities: Partial<ServerCapabilities>): void;
  hasCapability(capability: keyof ServerCapabilities): boolean;
  processClientCapabilities(clientCapabilities: ClientCapabilities): void;
  getClientCapabilities(): ClientCapabilities | null;
  isClientCapabilitySupported(capability: keyof ClientCapabilities): boolean;
}

/**
 * Primitive registry interface for tracking registered primitives
 */
export interface PrimitiveRegistry {
  getPromptCount(): number;
  getToolCount(): number;
  getResourceCount(): number;
  hasPrompts(): boolean;
  hasTools(): boolean;
  hasResources(): boolean;
}

/**
 * Lifecycle manager interface for MCP server state management.
 *
 * The LifecycleManager manages the server lifecycle according to the MCP protocol specification.
 * It handles state transitions (idle → initializing → ready → shutting-down), validates
 * operations against the current state, and emits lifecycle events for monitoring and integration.
 *
 * @example Basic lifecycle management
 * ```typescript
 * const lifecycleManager = new McpLifecycleManager(capabilityRegistry);
 *
 * // Listen for state changes
 * lifecycleManager.on(LifecycleEvent.STATE_CHANGED, (event) => {
 *   console.log(`State changed from ${event.previousState} to ${event.newState}`);
 * });
 *
 * // Initialize the server
 * const initializeRequest = {
 *   method: 'initialize',
 *   params: {
 *     protocolVersion: '2025-06-18',
 *     capabilities: { experimental: {} },
 *     clientInfo: { name: 'Test Client', version: '1.0.0' }
 *   }
 * };
 *
 * const result = await lifecycleManager.initialize(initializeRequest);
 * console.log('Server initialized:', result);
 *
 * // Check if server is ready
 * if (lifecycleManager.isReady) {
 *   console.log('Server is ready to process requests');
 * }
 *
 * // Shutdown when done
 * await lifecycleManager.shutdown('Server shutdown requested');
 * ```
 *
 * @example Operation validation
 * ```typescript
 * // Validate operations against current state
 * try {
 *   lifecycleManager.validateOperation('tools/list');
 *   // Operation is valid for current state
 * } catch (error) {
 *   if (error instanceof LifecycleViolationError) {
 *     console.error(`Operation not allowed in ${lifecycleManager.currentState} state`);
 *   }
 * }
 *
 * // Check state transitions
 * if (lifecycleManager.canTransitionTo(LifecycleState.READY)) {
 *   console.log('Can transition to ready state');
 * }
 * ```
 *
 * @example Event handling
 * ```typescript
 * // Listen for initialization events
 * lifecycleManager.on(LifecycleEvent.INITIALIZATION_STARTED, (event) => {
 *   console.log('Initialization started:', event.initializeRequest);
 * });
 *
 * lifecycleManager.on(LifecycleEvent.INITIALIZATION_COMPLETED, (event) => {
 *   console.log('Initialization completed:', event.initializeResult);
 * });
 *
 * lifecycleManager.on(LifecycleEvent.INITIALIZATION_FAILED, (event) => {
 *   console.error('Initialization failed:', event.error);
 * });
 *
 * // Listen for shutdown events
 * lifecycleManager.on(LifecycleEvent.SHUTDOWN_STARTED, (event) => {
 *   console.log('Shutdown started:', event.reason);
 * });
 * ```
 */
export interface LifecycleManager {
  readonly currentState: LifecycleState;
  readonly isInitialized: boolean;
  readonly hasBeenInitialized: boolean;
  readonly isReady: boolean;

  initialize(request: InitializeRequest): Promise<InitializeResult>;
  shutdown(reason?: string): Promise<void>;

  canTransitionTo(state: LifecycleState): boolean;
  validateOperation(operation: string): void;

  on(event: LifecycleEvent.STATE_CHANGED, listener: (event: StateChangeEvent) => void): void;
  on(
    event: LifecycleEvent.INITIALIZATION_STARTED | LifecycleEvent.INITIALIZATION_COMPLETED | LifecycleEvent.INITIALIZATION_FAILED,
    listener: (event: InitializationEvent) => void
  ): void;
  on(event: LifecycleEvent.SHUTDOWN_STARTED | LifecycleEvent.SHUTDOWN_COMPLETED, listener: (event: ShutdownEvent) => void): void;

  off(event: LifecycleEvent, listener: (...args: unknown[]) => void): void;
}

/**
 * Request gating interface for dispatcher integration
 */
export interface RequestGate {
  canProcessRequest(method: string): boolean;
  validateRequest(method: string): void;
  getValidationError(method: string): { code: number; message: string; data?: unknown } | null;
}
