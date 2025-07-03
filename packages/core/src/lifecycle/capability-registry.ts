import type { ClientCapabilities, ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { PromptRegistry } from '../registries/prompts';
import type { ResourceRegistry } from '../registries/resources';
import type { ToolRegistry } from '../registries/tools';
import type { CapabilityRegistry, PrimitiveRegistry } from './types';

/**
 * Default server capabilities for MCP servers
 */
const DEFAULT_CAPABILITIES: ServerCapabilities = {
  experimental: {},
  logging: {},
};

/**
 * Implementation of capability registry that dynamically generates server capabilities based on registered primitives.
 *
 * The McpCapabilityRegistry manages both server and client capabilities for MCP protocol negotiation.
 * It dynamically detects available capabilities from registered primitive registries (prompts, tools, resources)
 * and provides a unified interface for capability management during the MCP handshake process.
 *
 * @example Basic capability registry setup
 * ```typescript
 * const capabilityRegistry = new McpCapabilityRegistry({
 *   experimental: {},
 *   logging: {}
 * });
 *
 * // Set primitive registry for dynamic capability detection
 * const primitiveRegistry = new RegistryPrimitiveRegistry();
 * primitiveRegistry.registerPromptRegistry(promptRegistry);
 * primitiveRegistry.registerToolRegistry(toolRegistry);
 * capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
 *
 * // Get server capabilities for handshake
 * const serverCapabilities = capabilityRegistry.getServerCapabilities();
 * console.log(serverCapabilities); // { prompts: {}, tools: {}, experimental: {}, logging: {} }
 * ```
 *
 * @example Processing client capabilities
 * ```typescript
 * // During MCP initialize request
 * const clientCapabilities = {
 *   experimental: {},
 *   sampling: {}
 * };
 *
 * capabilityRegistry.processClientCapabilities(clientCapabilities);
 *
 * // Check if client supports specific capabilities
 * if (capabilityRegistry.isClientCapabilitySupported('sampling')) {
 *   console.log('Client supports sampling');
 * }
 * ```
 *
 * @example Dynamic capability updates
 * ```typescript
 * // Enable additional capabilities
 * capabilityRegistry.enablePrompts();
 * capabilityRegistry.enableTools();
 * capabilityRegistry.enableResources();
 *
 * // Update with custom capabilities
 * capabilityRegistry.updateCapabilities({
 *   experimental: {
 *     customFeature: { enabled: true }
 *   }
 * });
 *
 * // Check capability availability
 * if (capabilityRegistry.hasCapability('prompts')) {
 *   console.log('Prompts capability is enabled');
 * }
 * ```
 */
export class McpCapabilityRegistry implements CapabilityRegistry {
  private _capabilities: ServerCapabilities;
  private _primitiveRegistry: PrimitiveRegistry | null = null;
  private _clientCapabilities: ClientCapabilities | null = null;

  constructor(initialCapabilities: Partial<ServerCapabilities> = {}) {
    this._capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...initialCapabilities,
    };
  }

  /**
   * Set the primitive registry for dynamic capability detection.
   *
   * Links the capability registry to a primitive registry that contains registered
   * prompts, tools, and resources. This enables automatic capability detection
   * based on what primitives are actually registered in the server.
   *
   * @param registry - The primitive registry containing registered prompts, tools, and resources
   *
   * @example
   * ```typescript
   * const primitiveRegistry = new RegistryPrimitiveRegistry();
   * primitiveRegistry.registerPromptRegistry(promptRegistry);
   * primitiveRegistry.registerToolRegistry(toolRegistry);
   *
   * capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
   *
   * // Now getServerCapabilities() will automatically include prompts and tools
   * const capabilities = capabilityRegistry.getServerCapabilities();
   * ```
   */
  setPrimitiveRegistry(registry: PrimitiveRegistry): void {
    this._primitiveRegistry = registry;
  }

  /**
   * Process and store client capabilities from initialize request.
   *
   * Stores the client capabilities received during the MCP initialize handshake
   * for later capability negotiation and feature detection. This information
   * is used to determine what features the client supports.
   *
   * @param clientCapabilities - The capabilities declared by the client during initialization
   *
   * @example
   * ```typescript
   * // During MCP initialize request handling
   * const initializeRequest = {
   *   method: 'initialize',
   *   params: {
   *     protocolVersion: '2025-06-18',
   *     capabilities: {
   *       experimental: {},
   *       sampling: {}
   *     },
   *     clientInfo: { name: 'Test Client', version: '1.0.0' }
   *   }
   * };
   *
   * capabilityRegistry.processClientCapabilities(initializeRequest.params.capabilities);
   *
   * // Later check if client supports sampling
   * if (capabilityRegistry.isClientCapabilitySupported('sampling')) {
   *   // Enable sampling features
   * }
   * ```
   */
  processClientCapabilities(clientCapabilities: ClientCapabilities): void {
    this._clientCapabilities = clientCapabilities;
  }

  /**
   * Get the stored client capabilities
   */
  getClientCapabilities(): ClientCapabilities | null {
    return this._clientCapabilities;
  }

  /**
   * Check if the client supports a specific capability
   */
  isClientCapabilitySupported(capability: keyof ClientCapabilities): boolean {
    if (!this._clientCapabilities) {
      return false;
    }
    return capability in this._clientCapabilities && this._clientCapabilities[capability] !== undefined;
  }

  /**
   * Check if the client supports experimental capabilities
   */
  hasClientExperimentalCapabilities(): boolean {
    return (
      this.isClientCapabilitySupported('experimental') &&
      this._clientCapabilities?.experimental !== undefined &&
      Object.keys(this._clientCapabilities.experimental).length > 0
    );
  }

  /**
   * Check if the client supports sampling
   */
  hasClientSamplingCapabilities(): boolean {
    return this.isClientCapabilitySupported('sampling');
  }

  /**
   * Get client experimental capabilities
   */
  getClientExperimentalCapabilities(): Record<string, unknown> {
    return this._clientCapabilities?.experimental || {};
  }

  /**
   * Get current server capabilities, dynamically updated based on registered primitives
   */
  getServerCapabilities(): ServerCapabilities {
    let capabilities = { ...this._capabilities };

    if (this._primitiveRegistry) {
      if (this._primitiveRegistry instanceof RegistryPrimitiveRegistry) {
        const dynamicCapabilities = this._primitiveRegistry.getRegistryCapabilities();
        capabilities = this._mergeCapabilities(capabilities, dynamicCapabilities);
      } else {
        if (this._primitiveRegistry.hasPrompts()) {
          capabilities.prompts = capabilities.prompts || {};
        }

        if (this._primitiveRegistry.hasTools()) {
          capabilities.tools = capabilities.tools || {};
        }

        if (this._primitiveRegistry.hasResources()) {
          capabilities.resources = capabilities.resources || {
            subscribe: false,
            listChanged: false,
          };
        }
      }
    }

    return capabilities;
  }

  /**
   * Merge capabilities with proper deep merging for complex objects
   */
  private _mergeCapabilities(base: ServerCapabilities, dynamic: Partial<ServerCapabilities>): ServerCapabilities {
    const merged = { ...base };

    for (const [key, value] of Object.entries(dynamic)) {
      if (value !== undefined) {
        const typedKey = key as keyof ServerCapabilities;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const existingValue = merged[typedKey];
          if (typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue)) {
            merged[typedKey] = {
              ...existingValue,
              ...value,
            } as ServerCapabilities[typeof typedKey];
          } else {
            merged[typedKey] = value as ServerCapabilities[typeof typedKey];
          }
        } else {
          merged[typedKey] = value as ServerCapabilities[typeof typedKey];
        }
      }
    }

    return merged;
  }

  /**
   * Update server capabilities
   */
  updateCapabilities(capabilities: Partial<ServerCapabilities>): void {
    this._capabilities = {
      ...this._capabilities,
      ...capabilities,
    };
  }

  /**
   * Check if a specific capability is enabled
   */
  hasCapability(capability: keyof ServerCapabilities): boolean {
    const capabilities = this.getServerCapabilities();
    return capability in capabilities && capabilities[capability] !== undefined;
  }

  /**
   * Enable prompts capability
   */
  enablePrompts(): void {
    this.updateCapabilities({
      prompts: {},
    });
  }

  /**
   * Enable tools capability
   */
  enableTools(): void {
    this.updateCapabilities({
      tools: {},
    });
  }

  /**
   * Enable resources capability with optional subscription support
   */
  enableResources(options: { subscribe?: boolean; listChanged?: boolean } = {}): void {
    this.updateCapabilities({
      resources: {
        subscribe: options.subscribe || false,
        listChanged: options.listChanged || false,
      },
    });
  }

  /**
   * Enable completion capability
   */
  enableCompletion(): void {
    this.updateCapabilities({
      completion: {},
    });
  }

  /**
   * Enable logging capability
   */
  enableLogging(): void {
    this.updateCapabilities({
      logging: {},
    });
  }

  /**
   * Enable experimental capabilities
   */
  enableExperimental(experimentalCapabilities: Record<string, unknown> = {}): void {
    this.updateCapabilities({
      experimental: {
        ...this._capabilities.experimental,
        ...experimentalCapabilities,
      },
    });
  }

  /**
   * Add a specific experimental capability
   */
  addExperimentalCapability(name: string, config: unknown = {}): void {
    const currentExperimental = this._capabilities.experimental || {};
    this.updateCapabilities({
      experimental: {
        ...currentExperimental,
        [name]: config,
      },
    });
  }

  /**
   * Remove an experimental capability
   */
  removeExperimentalCapability(name: string): void {
    const currentExperimental = { ...this._capabilities.experimental };
    delete currentExperimental[name];
    this.updateCapabilities({
      experimental: currentExperimental,
    });
  }

  /**
   * Disable a capability
   */
  disableCapability(capability: keyof ServerCapabilities): void {
    const capabilities = { ...this._capabilities };
    delete capabilities[capability];
    this._capabilities = capabilities;
  }

  /**
   * Get capability summary for debugging
   */
  getCapabilitySummary(): {
    static: string[];
    dynamic: string[];
    total: number;
  } {
    const staticCapabilities = Object.keys(this._capabilities);
    const dynamicCapabilities: string[] = [];

    if (this._primitiveRegistry) {
      if (this._primitiveRegistry.hasPrompts() && !staticCapabilities.includes('prompts')) {
        dynamicCapabilities.push('prompts');
      }
      if (this._primitiveRegistry.hasTools() && !staticCapabilities.includes('tools')) {
        dynamicCapabilities.push('tools');
      }
      if (this._primitiveRegistry.hasResources() && !staticCapabilities.includes('resources')) {
        dynamicCapabilities.push('resources');
      }
    }

    return {
      static: staticCapabilities,
      dynamic: dynamicCapabilities,
      total: staticCapabilities.length + dynamicCapabilities.length,
    };
  }
}

/**
 * Registry-based primitive registry that integrates with actual registries
 */
export class RegistryPrimitiveRegistry implements PrimitiveRegistry {
  private _promptRegistry?: PromptRegistry;
  private _toolRegistry?: ToolRegistry;
  private _resourceRegistry?: ResourceRegistry;

  constructor(promptRegistry?: PromptRegistry, toolRegistry?: ToolRegistry, resourceRegistry?: ResourceRegistry) {
    if (promptRegistry) {
      this._promptRegistry = promptRegistry;
    }
    if (toolRegistry) {
      this._toolRegistry = toolRegistry;
    }
    if (resourceRegistry) {
      this._resourceRegistry = resourceRegistry;
    }
  }

  /**
   * Set the prompt registry
   */
  setPromptRegistry(registry: PromptRegistry): void {
    this._promptRegistry = registry;
  }

  /**
   * Set the tool registry
   */
  setToolRegistry(registry: ToolRegistry): void {
    this._toolRegistry = registry;
  }

  /**
   * Set the resource registry
   */
  setResourceRegistry(registry: ResourceRegistry): void {
    this._resourceRegistry = registry;
  }

  /**
   * Get combined capabilities from all registries
   */
  getRegistryCapabilities(): Partial<ServerCapabilities> {
    const capabilities: Partial<ServerCapabilities> = {};

    if (this._promptRegistry) {
      const promptCapabilities = this._promptRegistry.getCapabilities();
      if (Object.keys(promptCapabilities).length > 0) {
        Object.assign(capabilities, promptCapabilities);
      }
    }

    if (this._toolRegistry) {
      const toolCapabilities = this._toolRegistry.getCapabilities();
      if (Object.keys(toolCapabilities).length > 0) {
        Object.assign(capabilities, toolCapabilities);
      }
    }

    if (this._resourceRegistry) {
      const resourceCapabilities = this._resourceRegistry.getCapabilities();
      if (Object.keys(resourceCapabilities).length > 0) {
        Object.assign(capabilities, resourceCapabilities);
      }
    }

    return capabilities;
  }

  getPromptCount(): number {
    return this._promptRegistry?.getStats().totalRegistered || 0;
  }

  getToolCount(): number {
    return this._toolRegistry?.getStats().totalRegistered || 0;
  }

  getResourceCount(): number {
    return this._resourceRegistry?.getStats().totalRegistered || 0;
  }

  hasPrompts(): boolean {
    return this.getPromptCount() > 0;
  }

  hasTools(): boolean {
    return this.getToolCount() > 0;
  }

  hasResources(): boolean {
    return this.getResourceCount() > 0;
  }
}

/**
 * Mock primitive registry for testing and standalone usage
 */
export class MockPrimitiveRegistry implements PrimitiveRegistry {
  private _promptCount = 0;
  private _toolCount = 0;
  private _resourceCount = 0;

  setPromptCount(count: number): void {
    this._promptCount = count;
  }

  setToolCount(count: number): void {
    this._toolCount = count;
  }

  setResourceCount(count: number): void {
    this._resourceCount = count;
  }

  getPromptCount(): number {
    return this._promptCount;
  }

  getToolCount(): number {
    return this._toolCount;
  }

  getResourceCount(): number {
    return this._resourceCount;
  }

  hasPrompts(): boolean {
    return this._promptCount > 0;
  }

  hasTools(): boolean {
    return this._toolCount > 0;
  }

  hasResources(): boolean {
    return this._resourceCount > 0;
  }
}
