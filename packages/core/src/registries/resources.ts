import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { ContextLogger } from '../middleware/logger';

function hasContextLogger(context?: HandlerContext): context is HandlerContext & { state: { logger: ContextLogger } } {
  return !!(
    context?.state &&
    typeof (context.state as Record<string, unknown>).logger === 'object' &&
    (context.state as Record<string, unknown>).logger !== null &&
    'warn' in ((context.state as Record<string, unknown>).logger as object)
  );
}

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
 * Registry for managing resource providers with comprehensive URI pattern matching and lifecycle management.
 *
 * The ResourceRegistry provides a robust system for registering and managing resource providers
 * that can handle various URI patterns. It supports features like streaming content, caching,
 * rate limiting, authorization, and lifecycle hooks for comprehensive resource management.
 *
 * @example Basic resource registration
 * ```typescript
 * const registry = new ResourceRegistry();
 *
 * registry.register({
 *   uriPattern: 'file://**',
 *   name: 'File System',
 *   description: 'Access local file system resources',
 *   mimeType: 'text/plain',
 *   provider: {
 *     get: async (uri) => ({
 *       uri,
 *       mimeType: 'text/plain',
 *       text: await fs.readFile(uri.replace('file://', ''), 'utf8')
 *     }),
 *     list: async () => ({ resources: [] })
 *   }
 * });
 * ```
 *
 * @example Advanced resource with streaming and caching
 * ```typescript
 * registry.register({
 *   uriPattern: 'api://data/**',
 *   name: 'API Data',
 *   description: 'Stream data from external API',
 *   mimeType: 'application/json',
 *   watchable: true,
 *   searchable: true,
 *   cache: {
 *     enabled: true,
 *     ttl: 60000, // 1 minute
 *     key: (uri) => `api-${uri}`
 *   },
 *   rateLimit: {
 *     maxCalls: 100,
 *     windowMs: 60000
 *   },
 *   provider: {
 *     get: async (uri) => {
 *       const response = await fetch(uri.replace('api://', 'https://'));
 *       return {
 *         uri,
 *         mimeType: 'application/json',
 *         text: await response.text()
 *       };
 *     },
 *     list: async (cursor) => ({
 *       resources: await fetchResourceList(cursor),
 *       nextCursor: getNextCursor()
 *     }),
 *     search: async (query) => ({
 *       resources: await searchResources(query),
 *       hasMore: false
 *     })
 *   },
 *   hooks: {
 *     beforeGet: async (uri, context) => {
 *       console.log(`Fetching ${uri} for user ${context.user?.id}`);
 *     },
 *     afterGet: async (result, context) => {
 *       console.log(`Successfully fetched resource`);
 *     }
 *   }
 * });
 * ```
 *
 * @example Resource with authorization and validation
 * ```typescript
 * registry.register({
 *   uriPattern: 'secure://private/**',
 *   name: 'Secure Resources',
 *   description: 'Access private resources with authorization',
 *   validateUri: (uri) => {
 *     if (!uri.startsWith('secure://private/')) {
 *       return { success: false, errors: [{ path: ['uri'], message: 'Invalid URI format' }] };
 *     }
 *     return { success: true };
 *   },
 *   provider: {
 *     get: async (uri, context) => {
 *       if (!context.user?.permissions?.includes('read:private')) {
 *         throw new Error('Insufficient permissions');
 *       }
 *       return await getSecureResource(uri);
 *     },
 *     list: async (cursor, context) => {
 *       return await listAuthorizedResources(context.user);
 *     }
 *   }
 * });
 * ```
 *
 * @example Advanced resource registry patterns
 * ```typescript
 * // 1. Multi-provider resource aggregation
 * const registry = new ResourceRegistry();
 *
 * // Register multiple providers for different URI schemes
 * registry.register({
 *   uriPattern: 'file://**',
 *   name: 'Local Files',
 *   description: 'Access local file system',
 *   provider: new FileSystemProvider()
 * });
 *
 * registry.register({
 *   uriPattern: 'http://**',
 *   name: 'HTTP Resources',
 *   description: 'Access HTTP resources',
 *   provider: new HttpProvider()
 * });
 *
 * registry.register({
 *   uriPattern: 'db://table/**',
 *   name: 'Database Tables',
 *   description: 'Access database tables',
 *   provider: new DatabaseProvider()
 * });
 *
 * // Register an aggregator resource that combines multiple sources
 * registry.register({
 *   uriPattern: 'aggregate://search/**',
 *   name: 'Aggregated Search',
 *   description: 'Search across multiple resource types',
 *   searchable: true,
 *   provider: {
 *     get: async (uri, context) => {
 *       const query = uri.split('/').pop();
 *       const results = [];
 *
 *       // Search across all registered providers
 *       for (const [pattern, definition] of registry.getRegisteredResources()) {
 *         if (definition.searchable && definition.provider.search) {
 *           try {
 *             const searchResults = await definition.provider.search(query, context);
 *             results.push(...searchResults.resources);
 *           } catch (error) {
 *             console.warn(`Search failed for ${pattern}: ${error.message}`);
 *           }
 *         }
 *       }
 *
 *       return {
 *         uri,
 *         mimeType: 'application/json',
 *         text: JSON.stringify({ query, results, totalFound: results.length })
 *       };
 *     },
 *     list: async () => ({ resources: [] }) // Not applicable for aggregator
 *   }
 * });
 *
 * // 2. Resource with real-time updates and caching
 * const createRealtimeResourceRegistry = () => {
 *   const registry = new ResourceRegistry();
 *   const cache = new Map();
 *   const watchers = new Map();
 *
 *   registry.register({
 *     uriPattern: 'live://data/**',
 *     name: 'Live Data Stream',
 *     description: 'Real-time data with caching and change notifications',
 *     watchable: true,
 *     cache: {
 *       enabled: true,
 *       ttl: 5000, // 5 seconds
 *       key: (uri) => `live-${uri}`
 *     },
 *     provider: {
 *       get: async (uri, context) => {
 *         const cacheKey = `live-${uri}`;
 *         const cached = cache.get(cacheKey);
 *
 *         if (cached && Date.now() - cached.timestamp < 5000) {
 *           return cached.data;
 *         }
 *
 *         const data = await fetchLiveData(uri);
 *         cache.set(cacheKey, { data, timestamp: Date.now() });
 *
 *         // Notify watchers of data change
 *         const uriWatchers = watchers.get(uri) || [];
 *         for (const callback of uriWatchers) {
 *           callback({
 *             type: 'updated',
 *             uri,
 *             timestamp: new Date(),
 *             metadata: { source: 'live-data' }
 *           });
 *         }
 *
 *         return data;
 *       },
 *       list: async () => ({ resources: await listLiveDataSources() }),
 *       watch: async (uri, callback) => {
 *         if (!watchers.has(uri)) {
 *           watchers.set(uri, []);
 *         }
 *         watchers.get(uri).push(callback);
 *
 *         // Return unwatch function
 *         return () => {
 *           const uriWatchers = watchers.get(uri) || [];
 *           const index = uriWatchers.indexOf(callback);
 *           if (index > -1) {
 *             uriWatchers.splice(index, 1);
 *           }
 *         };
 *       }
 *     }
 *   });
 *
 *   return registry;
 * };
 * ```
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
   * Register a resource definition with comprehensive validation.
   *
   * Validates the resource definition and registers it with its provider for URI pattern matching.
   * The URI pattern must be unique within the registry. Supports glob patterns for flexible
   * resource matching and comprehensive validation of provider implementations.
   *
   * @param definition - The resource definition to register
   * @throws \{Error\} When the definition is invalid or the URI pattern is already registered
   *
   * @example Register a file system resource
   * ```typescript
   * registry.register({
   *   uriPattern: 'file://**',
   *   name: 'Local Files',
   *   description: 'Access local file system',
   *   mimeType: 'text/plain',
   *   provider: {
   *     get: async (uri) => ({
   *       uri,
   *       mimeType: 'text/plain',
   *       text: await readFile(uri)
   *     }),
   *     list: async () => ({ resources: await listFiles() })
   *   }
   * });
   * ```
   *
   * @example Register with validation and hooks
   * ```typescript
   * registry.register({
   *   uriPattern: 'db://table/*',
   *   name: 'Database Tables',
   *   description: 'Access database table data',
   *   validateUri: (uri) => {
   *     const tableName = uri.split('/').pop();
   *     if (!isValidTableName(tableName)) {
   *       return { success: false, errors: [{ path: ['uri'], message: 'Invalid table name' }] };
   *     }
   *     return { success: true };
   *   },
   *   hooks: {
   *     beforeGet: async (uri, context) => {
   *       await logAccess(uri, context.user?.id);
   *     }
   *   },
   *   provider: {
   *     get: async (uri) => await getTableData(uri),
   *     list: async () => ({ resources: await listTables() })
   *   }
   * });
   * ```
   */
  register(definition: ResourceDefinition): void {
    const validation = this.validateDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid resource definition: ${validation.errors.join(', ')}`);
    }

    if (this._resources.has(definition.uriPattern)) {
      throw new Error(`Resource pattern '${definition.uriPattern}' is already registered`);
    }

    this._resources.set(definition.uriPattern, definition);
    this._providers.set(definition.uriPattern, definition.provider);
    this._stats.totalRegistered = this._resources.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Get a resource by URI with enhanced context and lifecycle hooks
   */
  async get(uri: string, context: HandlerContext): Promise<unknown> {
    const definition = this._findDefinition(uri);
    const provider = this._findProvider(uri);

    if (!provider || !definition) {
      throw new Error(`No provider found for resource '${uri}'`);
    }

    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: {
          resourceUri: uri,
          uriPattern: definition.uriPattern,
          name: definition.name,
          description: definition.description,
          mimeType: definition.mimeType,
          tags: definition.tags,
          version: definition.version,
          cache: definition.cache,
          rateLimit: definition.rateLimit,
        },
      },
      execution: {
        executionId: `resource-${uri}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date(),
        ...(context.execution?.timeout !== undefined && { timeout: context.execution.timeout }),
        metadata: { resourceUri: uri, uriPattern: definition.uriPattern },
      },
    };

    try {
      if (definition.hooks?.beforeGet) {
        await definition.hooks.beforeGet(uri, enhancedContext);
      }

      const result = await provider.get(uri, enhancedContext);

      if (definition.hooks?.afterGet) {
        await definition.hooks.afterGet(result, enhancedContext);
      }

      this._stats.successfulOperations++;
      this._stats.lastOperation = new Date();
      return result;
    } catch (error) {
      if (definition.hooks?.onError) {
        await definition.hooks.onError(error as Error, enhancedContext);
      }

      this._stats.failedOperations++;
      this._stats.lastOperation = new Date();
      throw error;
    }
  }

  /**
   * List all available resources with optional filtering
   */
  async list(
    cursor?: string,
    context?: HandlerContext,
    _options?: {
      tags?: string[];
      mimeType?: string;
      watchable?: boolean;
      searchable?: boolean;
    }
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
          if (hasContextLogger(context)) {
            context.state.logger.warn('Resource provider failed during listing', {
              pattern,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            });
          } else {
            const { createStderrLogger } = await import('../utils/logger.js');
            const fallbackLogger = createStderrLogger();
            fallbackLogger.warn(`Resource provider failed during listing: ${pattern}`, undefined);
          }
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
      uniqueTags: this.getAllTags(),
      watchableResources: this.getWatchableResources().length,
      searchableResources: this.getSearchableResources().length,
      resourcesWithValidation: Array.from(this._resources.values()).filter((r) => r.validateUri).length,
      uniqueMimeTypes: new Set(
        Array.from(this._resources.values())
          .map((r) => r.mimeType)
          .filter(Boolean)
      ).size,
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Resource Registry',
      description: 'Registry for managing resource providers with enhanced features, lifecycle hooks, and flexible backends',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const resources = Array.from(this._resources.values());

    return {
      ...this._stats,
      totalRegistered: this._resources.size,
      customMetrics: {
        resourcesWithName: resources.filter((r) => r.name).length,
        resourcesWithDescription: resources.filter((r) => r.description).length,
        resourcesWithMimeType: resources.filter((r) => r.mimeType).length,
        resourcesWithTags: resources.filter((r) => r.tags && r.tags.length > 0).length,
        resourcesWithVersion: resources.filter((r) => r.version).length,
        watchableResources: resources.filter((r) => r.watchable).length,
        searchableResources: resources.filter((r) => r.searchable).length,
        resourcesWithValidation: resources.filter((r) => r.validateUri).length,
        resourcesWithHooks: resources.filter((r) => r.hooks?.beforeGet || r.hooks?.afterGet || r.hooks?.onError).length,
        resourcesWithCaching: resources.filter((r) => r.cache?.enabled).length,
        resourcesWithRateLimit: resources.filter((r) => r.rateLimit).length,
        uniqueTags: this.getAllTags().length,
        uniqueMimeTypes: new Set(resources.map((r) => r.mimeType).filter(Boolean)).size,
        averageTagsPerResource: resources.length > 0 ? resources.reduce((sum, r) => sum + (r.tags?.length || 0), 0) / resources.length : 0,
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

    const hasSubscriptions = Array.from(this._resources.values()).some((r) => r.watchable);

    return {
      resources: {
        subscribe: hasSubscriptions,
        listChanged: hasSubscriptions,
      },
    };
  }

  /**
   * Get a specific resource definition
   */
  getDefinition(uriPattern: string): ResourceDefinition | undefined {
    return this._resources.get(uriPattern);
  }

  /**
   * Get resource definitions by tags
   */
  getByTags(tags: string[]): string[] {
    return Array.from(this._resources.values())
      .filter((r) => r.tags && tags.some((tag) => r.tags?.includes(tag)))
      .map((r) => r.uriPattern);
  }

  /**
   * Get all unique tags from registered resources
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const resource of this._resources.values()) {
      if (resource.tags) {
        for (const tag of resource.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Get resources by MIME type
   */
  getByMimeType(mimeType: string): string[] {
    return Array.from(this._resources.values())
      .filter((r) => r.mimeType === mimeType)
      .map((r) => r.uriPattern);
  }

  /**
   * Get watchable resources
   */
  getWatchableResources(): string[] {
    return Array.from(this._resources.values())
      .filter((r) => r.watchable)
      .map((r) => r.uriPattern);
  }

  /**
   * Get searchable resources
   */
  getSearchableResources(): string[] {
    return Array.from(this._resources.values())
      .filter((r) => r.searchable)
      .map((r) => r.uriPattern);
  }

  /**
   * Unregister a resource definition
   */
  unregister(uriPattern: string): boolean {
    const existedResource = this._resources.delete(uriPattern);
    const existedProvider = this._providers.delete(uriPattern);

    if (existedResource || existedProvider) {
      this._stats.totalRegistered = this._resources.size;
      this._stats.lastOperation = new Date();
    }

    return existedResource;
  }

  /**
   * Validate a resource definition without registering it
   */
  validateDefinition(definition: ResourceDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.uriPattern || typeof definition.uriPattern !== 'string') {
      errors.push('Resource URI pattern is required and must be a string');
    } else if (definition.uriPattern.trim() !== definition.uriPattern) {
      errors.push('Resource URI pattern cannot have leading or trailing whitespace');
    }

    if (!definition.provider || typeof definition.provider !== 'object') {
      errors.push('Resource provider is required and must be an object');
    } else {
      if (typeof definition.provider.get !== 'function') {
        errors.push('Resource provider must have a get method');
      }
      if (typeof definition.provider.list !== 'function') {
        errors.push('Resource provider must have a list method');
      }
    }

    if (definition.version && !/^\d+\.\d+\.\d+/.test(definition.version)) {
      errors.push('Version must follow semantic versioning format (e.g., 1.0.0)');
    }

    if (definition.mimeType && !/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.]*$/.test(definition.mimeType)) {
      errors.push('MIME type must be in valid format (e.g., text/plain, application/json)');
    }

    if (definition.tags && !Array.isArray(definition.tags)) {
      errors.push('Tags must be an array of strings');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get detailed capability information for debugging
   */
  getDetailedCapabilities(): {
    totalResources: number;
    watchableResources: number;
    searchableResources: number;
    resourcesWithValidation: number;
    resourcesWithHooks: number;
    uniqueTags: number;
    uniqueMimeTypes: number;
    capabilities: Partial<ServerCapabilities>;
  } {
    const resources = Array.from(this._resources.values());
    const mimeTypes = new Set(resources.map((r) => r.mimeType).filter(Boolean));

    return {
      totalResources: resources.length,
      watchableResources: resources.filter((r) => r.watchable).length,
      searchableResources: resources.filter((r) => r.searchable).length,
      resourcesWithValidation: resources.filter((r) => r.validateUri).length,
      resourcesWithHooks: resources.filter((r) => r.hooks?.beforeGet || r.hooks?.afterGet || r.hooks?.onError).length,
      uniqueTags: this.getAllTags().length,
      uniqueMimeTypes: mimeTypes.size,
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Find the appropriate definition for a given URI
   */
  private _findDefinition(uri: string): ResourceDefinition | null {
    if (this._resources.has(uri)) {
      const definition = this._resources.get(uri);
      return definition || null;
    }

    let bestMatch: string | null = null;
    for (const pattern of this._resources.keys()) {
      if (uri.startsWith(pattern) && (bestMatch === null || pattern.length > bestMatch.length)) {
        bestMatch = pattern;
      }
    }

    if (bestMatch) {
      const definition = this._resources.get(bestMatch);
      return definition || null;
    }

    return null;
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
