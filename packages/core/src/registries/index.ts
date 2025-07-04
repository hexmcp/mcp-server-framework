/**
 * @hexmcp/core/registries - Domain-specific registries for MCP server framework
 *
 * This module provides specialized registries for managing prompts, tools, and resources
 * with type safety, capability negotiation, and middleware integration.
 */

// Base registry interfaces and types
export type {
  LifecycleAwareRegistry,
  Registry,
  RegistryCollection,
  RegistryKind,
  RegistryMetadata,
  RegistryStats,
} from './base';
export { DefaultRegistryCollection, REGISTRY_KINDS } from './base';
// Registry implementations
export { PromptRegistry } from './prompts';
export { InMemoryResourceProvider, ResourceRegistry } from './resources';
export { ToolRegistry } from './tools';
// Shared types and interfaces
export type {
  HandlerContext,
  HandlerExecutionContext,
  PromptArgument,
  PromptContent,
  PromptDefinition,
  ResourceChangeEvent,
  ResourceDefinition,
  ResourceListResult,
  ResourceMetadata,
  ResourceProvider,
  ToolDefinition,
  ToolParameter,
  ValidationResult,
} from './types';
