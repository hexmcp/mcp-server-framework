// Types and interfaces

// Capability management
export {
  McpCapabilityRegistry,
  MockPrimitiveRegistry,
} from './capability-registry.js';
// Handshake handlers
export { McpHandshakeHandlers } from './handshake-handlers.js';
// Request gating
export {
  McpRequestGate,
  RequestCategory,
} from './request-gate.js';
// Core state machine
export { McpLifecycleManager } from './state-machine.js';
export {
  AlreadyInitializedError,
  type CapabilityRegistry,
  type InitializationEvent,
  InvalidStateTransitionError,
  LifecycleEvent,
  type LifecycleManager,
  LifecycleState,
  LifecycleViolationError,
  NotInitializedError,
  type PrimitiveRegistry,
  type RequestGate,
  type ShutdownEvent,
  type StateChangeEvent,
  VALID_TRANSITIONS,
} from './types.js';
