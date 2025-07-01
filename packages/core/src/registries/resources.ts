import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry, RegistryMetadata, RegistryStats } from './base';
import { REGISTRY_KINDS } from './base';
import type { HandlerContext, ResourceDefinition, ResourceProvider } from './types';

/**
 * In-memory resource provider for simple use cases
 */
export class InMemoryResourceProvider implements ResourceProvider {
  private readonly _resources = new Map<
    string,
    {
      content: unknown;
      name?: string;
      description?: string;
      mimeType?: string;
    }
  >();

  /**
   * Add a resource to the in-memory store
   */
  addResource(uri: string, content: unknown, metadata?: { name?: string; description?: string; mimeType?: string }): void {
    this._resources.set(uri, { content, ...metadata });
  }

  /**
   * Remove a resource from the in-memory store
   */
  removeResource(uri: string): boolean {
    return this._resources.delete(uri);
  }

  async get(uri: string, _context: HandlerContext): Promise<unknown> {
    const resource = this._resources.get(uri);
    if (!resource) {
      throw new Error(`Resource '${uri}' not found`);
    }
    return resource.content;
  }

  async list(
    cursor?: string,
    _context?: HandlerContext
  ): Promise<{
    resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
    nextCursor?: string;
  }> {
    const resources = Array.from(this._resources.entries()).map(([uri, { name, description, mimeType }]) => {
      const result: { uri: string; name?: string; description?: string; mimeType?: string } = { uri };
      if (name !== undefined) {
        result.name = name;
      }
      if (description !== undefined) {
        result.description = description;
      }
      if (mimeType !== undefined) {
        result.mimeType = mimeType;
      }
      return result;
    });

    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const pageSize = 50;
    const endIndex = startIndex + pageSize;
    const paginatedResources = resources.slice(startIndex, endIndex);

    const result: {
      resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
      nextCursor?: string;
    } = {
      resources: paginatedResources,
    };

    if (endIndex < resources.length) {
      result.nextCursor = endIndex.toString();
    }

    return result;
  }
}

/**
 * Registry for managing resource providers
 */
export class ResourceRegistry implements Registry {
  public readonly kind = REGISTRY_KINDS.RESOURCES;
  private readonly _resources = new Map<string, ResourceDefinition>();
  private readonly _providers = new Map<string, ResourceProvider>();
  private readonly _stats: RegistryStats = {
    totalRegistered: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };

  /**
   * Register a resource definition
   */
  register(definition: ResourceDefinition): void {
    if (this._resources.has(definition.uriPattern)) {
      throw new Error(`Resource pattern '${definition.uriPattern}' is already registered`);
    }
    this._resources.set(definition.uriPattern, definition);
    this._providers.set(definition.uriPattern, definition.provider);
    this._stats.totalRegistered = this._resources.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Get a resource by URI
   */
  async get(uri: string, context: HandlerContext): Promise<unknown> {
    const provider = this._findProvider(uri);
    if (!provider) {
      throw new Error(`No provider found for resource '${uri}'`);
    }

    // Add registry metadata to context
    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: { resourceUri: uri },
      },
    };

    try {
      const result = await provider.get(uri, enhancedContext);
      this._stats.successfulOperations++;
      this._stats.lastOperation = new Date();
      return result;
    } catch (error) {
      this._stats.failedOperations++;
      this._stats.lastOperation = new Date();
      throw error;
    }
  }

  /**
   * List all available resources
   */
  async list(
    cursor?: string,
    context?: HandlerContext
  ): Promise<{
    resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
    nextCursor?: string;
  }> {
    const allResources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> = [];

    for (const [pattern, provider] of this._providers) {
      const enhancedContext: HandlerContext = context
        ? {
            ...context,
            registry: {
              kind: this.kind,
              metadata: { uriPattern: pattern },
            },
          }
        : {
            request: { method: 'resources/list', id: 'internal', jsonrpc: '2.0' },
            send: async () => {
              return;
            },
            transport: { name: 'internal' },
            state: {},
            registry: {
              kind: this.kind,
              metadata: { uriPattern: pattern },
            },
          };

      try {
        const result = await provider.list(cursor, enhancedContext);
        allResources.push(...result.resources);
      } catch (error) {
        if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
          // biome-ignore lint/suspicious/noConsole: Intentional logging for provider errors
          console.warn(`Failed to list resources from provider '${pattern}':`, error);
        }
      }
    }

    const result: {
      resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
      nextCursor?: string;
    } = {
      resources: allResources,
    };

    return result;
  }

  /**
   * Check if a resource URI has a registered provider
   */
  has(uri: string): boolean {
    return this._findProvider(uri) !== null;
  }

  /**
   * Get the number of registered resource patterns
   */
  size(): number {
    return this._resources.size;
  }

  /**
   * Check if the registry is empty
   */
  isEmpty(): boolean {
    return this._resources.size === 0;
  }

  /**
   * Clear all registered resources
   */
  clear(): void {
    this._resources.clear();
    this._providers.clear();
    this._stats.totalRegistered = 0;
    this._stats.lastOperation = new Date();
  }

  /**
   * Get registry metadata
   */
  getMetadata(): RegistryMetadata {
    const debug: RegistryMetadata['debug'] = {
      registeredCount: this._resources.size,
      uriPatterns: Array.from(this._resources.keys()),
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Resource Registry',
      description: 'Registry for managing resource providers with flexible backends and pagination support',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    return {
      ...this._stats,
      totalRegistered: this._resources.size,
      customMetrics: {
        resourcesWithName: Array.from(this._resources.values()).filter((r) => r.name).length,
        resourcesWithDescription: Array.from(this._resources.values()).filter((r) => r.description).length,
        resourcesWithMimeType: Array.from(this._resources.values()).filter((r) => r.mimeType).length,
      },
    };
  }

  /**
   * Get capabilities for MCP handshake
   */
  getCapabilities(): Partial<ServerCapabilities> {
    if (this._resources.size === 0) {
      return {};
    }

    return {
      resources: {
        subscribe: false,
        listChanged: false,
      },
    };
  }

  /**
   * Find the appropriate provider for a given URI
   */
  private _findProvider(uri: string): ResourceProvider | null {
    if (this._providers.has(uri)) {
      const provider = this._providers.get(uri);
      return provider || null;
    }

    let bestMatch: string | null = null;
    for (const pattern of this._providers.keys()) {
      if (uri.startsWith(pattern) && (bestMatch === null || pattern.length > bestMatch.length)) {
        bestMatch = pattern;
      }
    }

    if (bestMatch) {
      const provider = this._providers.get(bestMatch);
      return provider || null;
    }

    return null;
  }
}
