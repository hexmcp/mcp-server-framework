/**
 * @hexmcp/core/registries - Domain-specific registries for MCP server framework
 *
 * This module provides specialized registries for managing prompts, tools, and resources
 * with type safety, capability negotiation, and middleware integration.
 */

// Base registry interfaces and types
export type {
  /** @internal */
  LifecycleAwareRegistry,
  /** @internal */
  Registry,
  /** @internal */
  RegistryCollection,
  /** @internal */
  RegistryKind,
  /** @internal */
  RegistryMetadata,
  /** @internal */
  RegistryStats,
} from './base';
/** @internal */
export { DefaultRegistryCollection, REGISTRY_KINDS } from './base';
// Registry implementations
/** @internal */
export { PromptRegistry } from './prompts';
/** @internal */
export { InMemoryResourceProvider, ResourceRegistry } from './resources';
/** @internal */
export { ToolRegistry } from './tools';
// Shared types and interfaces
export type {
  HandlerContext,
  PromptDefinition,
  ResourceDefinition,
  ResourceProvider,
  ToolDefinition,
} from './types';
