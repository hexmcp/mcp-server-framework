// Types and interfaces

// Capability management
export {
  McpCapabilityRegistry,
  MockPrimitiveRegistry,
} from './capability-registry';
// Handshake handlers
export { McpHandshakeHandlers } from './handshake-handlers';
// Request gating
export {
  McpRequestGate,
  RequestCategory,
} from './request-gate';
// Core state machine
export { McpLifecycleManager } from './state-machine';
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
} from './types';
