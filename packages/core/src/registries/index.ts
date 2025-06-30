/**
 * @hexmcp/core/registries - Domain-specific registries for MCP server framework
 *
 * This module provides specialized registries for managing prompts, tools, and resources
 * with type safety, capability negotiation, and middleware integration.
 */

// Base registry interface
export type { Registry } from './base';
// Registry implementations
export { PromptRegistry } from './prompts';
export { InMemoryResourceProvider, ResourceRegistry } from './resources';
export { ToolRegistry } from './tools';
// Shared types and interfaces
export type {
  HandlerContext,
  PromptDefinition,
  ResourceDefinition,
  ResourceProvider,
  ToolDefinition,
} from './types';
