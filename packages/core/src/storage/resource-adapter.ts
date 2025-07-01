/**
 * @fileoverview ResourceProvider adapter using LRU store
 * Internal storage module - not exported in public API
 */

import type { HandlerContext, ResourceContent, ResourceListResult, ResourceProvider } from '../registries/types';
import { LruStoreImpl, type LruStoreOptions } from './lru-store';

/**
 * Configuration options for LRU resource store
 */
export interface LruResourceStoreOptions extends LruStoreOptions {
  /**
   * Whether to collect statistics for cache operations
   */
  collectStats?: boolean;

  /**
   * Default MIME type for stored resources
   */
  defaultMimeType?: string;
}

/**
 * ResourceProvider implementation backed by an LRU store
 *
 * This adapter allows using the LRU store as a caching layer for resources
 * in the ResourceRegistry. It stores ResourceContent objects and provides
 * efficient O(1) access with automatic eviction and TTL support.
 *
 * @template T - The type of data stored in resources
 */
export class LruResourceStore<T = unknown> implements ResourceProvider {
  private readonly _store: LruStoreImpl<string, ResourceContent>;
  private readonly _defaultMimeType: string;

  constructor(options: LruResourceStoreOptions) {
    if (options.defaultTtlMs !== undefined) {
      this._store = new LruStoreImpl({
        maxItems: options.maxItems,
        defaultTtlMs: options.defaultTtlMs,
        collectStats: options.collectStats ?? false,
      });
    } else {
      this._store = new LruStoreImpl({
        maxItems: options.maxItems,
        collectStats: options.collectStats ?? false,
      });
    }
    this._defaultMimeType = options.defaultMimeType ?? 'application/octet-stream';
  }

  /**
   * Get a resource by URI from the LRU cache
   */
  async get(uri: string, _context: HandlerContext): Promise<ResourceContent | unknown> {
    const cached = this._store.get(uri);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }
    return undefined;
  }

  /**
   * List all cached resources with optional pagination
   *
   * Note: This implementation returns all cached resources.
   * In a real-world scenario, you might want to implement
   * proper pagination based on the cursor parameter.
   */
  async list(cursor?: string, _context?: HandlerContext): Promise<ResourceListResult> {
    const resources: ResourceContent['metadata'][] = [];

    for (const [uri, content] of this._entries()) {
      if (cursor && uri <= cursor) {
        continue;
      }

      resources.push(content.metadata);
    }

    return {
      resources,
      hasMore: false,
    };
  }

  /**
   * Add a resource to the cache
   */
  addResource(uri: string, data: T, metadata?: Partial<ResourceContent['metadata']>, ttlMs?: number): void {
    const resourceMetadata: ResourceContent['metadata'] = {
      uri,
      mimeType: metadata?.mimeType ?? this._defaultMimeType,
      lastModified: metadata?.lastModified ?? new Date(),
    };

    if (metadata?.name !== undefined) {
      resourceMetadata.name = metadata.name;
    }

    if (metadata?.description !== undefined) {
      resourceMetadata.description = metadata.description;
    }

    if (metadata?.size !== undefined) {
      resourceMetadata.size = metadata.size;
    }

    if (metadata?.tags !== undefined) {
      resourceMetadata.tags = metadata.tags;
    }

    if (metadata?.metadata !== undefined) {
      resourceMetadata.metadata = metadata.metadata;
    }

    const resourceContent: ResourceContent = {
      data,
      metadata: resourceMetadata,
      cached: true,
    };

    this._store.set(uri, resourceContent, ttlMs);
  }

  /**
   * Remove a resource from the cache
   */
  removeResource(uri: string): boolean {
    return this._store.delete(uri);
  }

  /**
   * Check if a resource exists in the cache
   */
  hasResource(uri: string): boolean {
    return this._store.has(uri);
  }

  /**
   * Clear all cached resources
   */
  clear(): void {
    this._store.clear();
  }

  /**
   * Get the number of cached resources
   */
  get size(): number {
    return this._store.size;
  }

  /**
   * Get cache statistics if enabled
   */
  getStats() {
    return this._store.stats();
  }

  /**
   * Get an iterator over all cached entries
   */
  private *_entries(): IterableIterator<[string, ResourceContent]> {
    for (const uri of this._store.keys()) {
      const content = this._store.get(uri);
      if (content) {
        yield [uri, content];
      }
    }
  }
}

/**
 * Factory function to create an LRU-backed ResourceProvider
 *
 * This is the recommended way to create an LRU resource store for use
 * with the ResourceRegistry. It provides a simple interface for creating
 * a caching layer with configurable capacity and TTL.
 *
 * @param maxItems - Maximum number of resources to cache before evicting LRU items
 * @param defaultTtlMs - Optional default TTL in milliseconds for cached resources
 * @param options - Additional configuration options
 * @returns A ResourceProvider instance backed by an LRU store
 *
 * @example
 * ```typescript
 * // Create a simple LRU cache with capacity of 100 items
 * const resourceCache = createLruResourceStore(100);
 *
 * // Create an LRU cache with TTL
 * const resourceCacheWithTtl = createLruResourceStore(50, 5 * 60 * 1000); // 5 minutes
 *
 * // Create an LRU cache with custom options
 * const resourceCacheWithStats = createLruResourceStore(100, undefined, {
 *   collectStats: true,
 *   defaultMimeType: 'application/json'
 * });
 * ```
 */
export function createLruResourceStore<T = unknown>(
  maxItems: number,
  defaultTtlMs?: number,
  options?: {
    collectStats?: boolean;
    defaultMimeType?: string;
  }
): LruResourceStore<T> {
  const storeOptions: LruResourceStoreOptions = {
    maxItems,
    collectStats: options?.collectStats ?? false,
    defaultMimeType: options?.defaultMimeType ?? 'application/octet-stream',
  };

  if (defaultTtlMs !== undefined) {
    storeOptions.defaultTtlMs = defaultTtlMs;
  }

  return new LruResourceStore<T>(storeOptions);
}
