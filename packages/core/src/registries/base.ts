import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';

/**
 * Registry kind constants for type safety
 */
export const REGISTRY_KINDS = {
  PROMPTS: 'prompts',
  TOOLS: 'tools',
  RESOURCES: 'resources',
} as const;

export type RegistryKind = (typeof REGISTRY_KINDS)[keyof typeof REGISTRY_KINDS];

/**
 * Registry metadata for introspection and debugging
 */
export interface RegistryMetadata {
  /**
   * Human-readable name of the registry
   */
  name: string;

  /**
   * Description of what this registry manages
   */
  description?: string;

  /**
   * Additional metadata for debugging
   */
  debug?: {
    registeredCount: number;
    lastModified?: Date;
    [key: string]: unknown;
  };
}

/**
 * Registry statistics for monitoring and debugging
 */
export interface RegistryStats {
  /**
   * Total number of registered items
   */
  totalRegistered: number;

  /**
   * Number of successful operations
   */
  successfulOperations: number;

  /**
   * Number of failed operations
   */
  failedOperations: number;

  /**
   * Last operation timestamp
   */
  lastOperation?: Date;

  /**
   * Registry-specific metrics
   */
  customMetrics?: Record<string, number>;
}

/**
 * Base registry interface that all domain-specific registries must implement.
 *
 * The Registry interface defines the contract for all domain-specific registries
 * (prompts, tools, resources) in the MCP server framework. It provides a unified
 * API for capability negotiation, metadata introspection, and lifecycle management.
 *
 * @example Implementing a custom registry
 * ```typescript
 * class CustomRegistry implements Registry {
 *   readonly kind = 'custom' as const;
 *   private items = new Map<string, CustomItem>();
 *   private stats: RegistryStats = {
 *     totalRegistered: 0,
 *     successfulOperations: 0,
 *     failedOperations: 0
 *   };
 *
 *   getCapabilities(): Partial<ServerCapabilities> {
 *     return this.isEmpty() ? {} : { custom: {} };
 *   }
 *
 *   getMetadata(): RegistryMetadata {
 *     return {
 *       name: 'Custom Registry',
 *       description: 'Registry for custom items',
 *       debug: {
 *         registeredCount: this.items.size,
 *         itemNames: Array.from(this.items.keys())
 *       }
 *     };
 *   }
 *
 *   getStats(): RegistryStats {
 *     return { ...this.stats };
 *   }
 *
 *   isEmpty(): boolean {
 *     return this.items.size === 0;
 *   }
 *
 *   size(): number {
 *     return this.items.size;
 *   }
 *
 *   clear(): void {
 *     this.items.clear();
 *     this.stats.totalRegistered = 0;
 *   }
 * }
 * ```
 *
 * @example Using registry in capability negotiation
 * ```typescript
 * const registries: Registry[] = [promptRegistry, toolRegistry, resourceRegistry];
 *
 * // Combine capabilities from all registries
 * const serverCapabilities = registries.reduce((caps, registry) => ({
 *   ...caps,
 *   ...registry.getCapabilities()
 * }), {} as ServerCapabilities);
 *
 * // Check if any registries have content
 * const hasContent = registries.some(registry => !registry.isEmpty());
 *
 * // Get combined statistics
 * const stats = registries.map(registry => ({
 *   kind: registry.kind,
 *   ...registry.getStats()
 * }));
 * ```
 */
export interface Registry {
  /**
   * Registry type identifier for capability negotiation.
   *
   * A unique identifier that determines what type of MCP primitives this registry manages.
   * Used during capability negotiation to determine which server capabilities to advertise.
   *
   * @example
   * ```typescript
   * class PromptRegistry implements Registry {
   *   readonly kind = REGISTRY_KINDS.PROMPTS; // 'prompts'
   * }
   *
   * class ToolRegistry implements Registry {
   *   readonly kind = REGISTRY_KINDS.TOOLS; // 'tools'
   * }
   * ```
   */
  readonly kind: RegistryKind;

  /**
   * Get capabilities that this registry provides for MCP handshake.
   *
   * Returns the server capabilities that should be advertised to clients based on
   * what primitives are registered in this registry. Empty registries typically
   * return empty capabilities to avoid advertising unavailable features.
   *
   * @returns Partial server capabilities object for MCP protocol negotiation
   *
   * @example
   * ```typescript
   * // Empty registry returns no capabilities
   * if (promptRegistry.isEmpty()) {
   *   return {}; // Don't advertise prompts capability
   * }
   *
   * // Registry with content advertises its capability
   * return { prompts: {} }; // Advertise prompts capability
   * ```
   */
  getCapabilities(): Partial<ServerCapabilities>;

  /**
   * Get registry metadata for introspection
   */
  getMetadata(): RegistryMetadata;

  /**
   * Get registry statistics for monitoring
   */
  getStats(): RegistryStats;

  /**
   * Check if the registry has any registered items
   */
  isEmpty(): boolean;

  /**
   * Get the number of registered items
   */
  size(): number;

  /**
   * Clear all registered items
   */
  clear(): void;
}

/**
 * Enhanced registry interface with lifecycle hooks
 */
export interface LifecycleAwareRegistry extends Registry {
  /**
   * Called when the registry is being initialized
   */
  onInitialize?(): Promise<void> | void;

  /**
   * Called when the registry is being shut down
   */
  onShutdown?(): Promise<void> | void;

  /**
   * Called when the server capabilities are being negotiated
   */
  onCapabilityNegotiation?(clientCapabilities: Partial<ServerCapabilities>): Promise<void> | void;
}

/**
 * Registry collection interface for managing multiple registries
 */
export interface RegistryCollection {
  /**
   * Register a new registry
   */
  register(registry: Registry): void;

  /**
   * Get a registry by kind
   */
  get(kind: RegistryKind): Registry | undefined;

  /**
   * Get all registered registries
   */
  getAll(): Registry[];

  /**
   * Get combined capabilities from all registries
   */
  getCombinedCapabilities(): ServerCapabilities;

  /**
   * Check if any registry has registered items
   */
  hasAnyRegistrations(): boolean;

  /**
   * Get combined statistics from all registries
   */
  getCombinedStats(): Record<RegistryKind, RegistryStats>;
}

/**
 * Default implementation of RegistryCollection
 */
export class DefaultRegistryCollection implements RegistryCollection {
  private readonly _registries = new Map<RegistryKind, Registry>();

  register(registry: Registry): void {
    if (this._registries.has(registry.kind)) {
      throw new Error(`Registry of kind '${registry.kind}' is already registered`);
    }
    this._registries.set(registry.kind, registry);
  }

  get(kind: RegistryKind): Registry | undefined {
    return this._registries.get(kind);
  }

  getAll(): Registry[] {
    return Array.from(this._registries.values());
  }

  getCombinedCapabilities(): ServerCapabilities {
    const combined: ServerCapabilities = {
      experimental: {},
      logging: {},
    };

    for (const registry of this._registries.values()) {
      const capabilities = registry.getCapabilities();
      Object.assign(combined, capabilities);
    }

    return combined;
  }

  hasAnyRegistrations(): boolean {
    return Array.from(this._registries.values()).some((registry) => !registry.isEmpty());
  }

  getCombinedStats(): Record<RegistryKind, RegistryStats> {
    const stats = {} as Record<RegistryKind, RegistryStats>;

    for (const [kind, registry] of this._registries) {
      stats[kind] = registry.getStats();
    }

    return stats;
  }

  /**
   * Remove a registry by kind
   */
  unregister(kind: RegistryKind): boolean {
    return this._registries.delete(kind);
  }

  /**
   * Clear all registries
   */
  clear(): void {
    this._registries.clear();
  }

  /**
   * Get the number of registered registries
   */
  size(): number {
    return this._registries.size;
  }
}
