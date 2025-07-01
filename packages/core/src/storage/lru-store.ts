/**
 * @fileoverview LRU Store implementation with TTL support
 * Internal storage module - not exported in public API
 */

/**
 * Configuration options for creating an LRU store
 */
export interface LruStoreOptions {
  /**
   * Maximum number of items to store before evicting least recently used items
   */
  maxItems: number;

  /**
   * Default TTL in milliseconds for items when not specified in set()
   * If not provided, items don't expire by default
   */
  defaultTtlMs?: number;
}

/**
 * Statistics for LRU store operations
 */
export interface LruStats {
  /**
   * Number of cache hits
   */
  hits: number;

  /**
   * Number of cache misses
   */
  misses: number;

  /**
   * Number of items evicted due to capacity limits
   */
  evictions: number;

  /**
   * Number of items expired due to TTL
   */
  expirations: number;
}

/**
 * Internal entry structure for storing values with optional expiration
 */
interface LruEntry<V> {
  /**
   * The stored value
   */
  value: V;

  /**
   * Optional expiration timestamp in milliseconds (Date.now() format)
   * If undefined, the entry never expires
   */
  expiresAt?: number;
}

/**
 * Generic LRU (Least Recently Used) store with TTL support
 *
 * Features:
 * - LRU eviction when capacity is exceeded
 * - Optional TTL (Time To Live) support with lazy expiration
 * - Efficient O(1) operations for get, set, delete, has
 * - Iterator support for keys and values
 * - Optional statistics collection
 */
export interface LruStore<K, V> {
  /**
   * Get a value by key. Updates the item's position to most recently used.
   * Returns undefined if key doesn't exist or has expired.
   *
   * @param key - The key to look up
   * @returns The value if found and not expired, undefined otherwise
   */
  get(key: K): V | undefined;

  /**
   * Set a key-value pair with optional TTL.
   * If the key already exists, updates the value and TTL.
   * If capacity is exceeded, evicts the least recently used item.
   *
   * @param key - The key to set
   * @param value - The value to store
   * @param ttlMs - Optional TTL in milliseconds. If not provided, uses defaultTtlMs from options
   */
  set(key: K, value: V, ttlMs?: number): void;

  /**
   * Delete a key-value pair from the store.
   *
   * @param key - The key to delete
   * @returns true if the key existed and was deleted, false otherwise
   */
  delete(key: K): boolean;

  /**
   * Check if a key exists in the store and has not expired.
   * Does not update the item's position (unlike get()).
   *
   * @param key - The key to check
   * @returns true if the key exists and has not expired, false otherwise
   */
  has(key: K): boolean;

  /**
   * Get an iterator over all non-expired keys in the store.
   * Keys are returned in order from most recently used to least recently used.
   *
   * @returns Iterator over keys
   */
  keys(): IterableIterator<K>;

  /**
   * Get an iterator over all non-expired values in the store.
   * Values are returned in order from most recently used to least recently used.
   *
   * @returns Iterator over values
   */
  values(): IterableIterator<V>;

  /**
   * Get the current number of non-expired items in the store.
   */
  readonly size: number;

  /**
   * Clear all items from the store.
   */
  clear(): void;

  /**
   * Get statistics about store operations.
   * Returns undefined if statistics collection is not enabled.
   *
   * @returns Statistics object or undefined
   */
  stats(): LruStats | undefined;
}

/**
 * Implementation of LRU store using Map for O(1) operations
 *
 * Uses the Map's insertion order property for LRU tracking:
 * - Most recently used items are at the end (last inserted)
 * - Least recently used items are at the beginning (first inserted)
 * - Re-inserting a key moves it to the end (most recent)
 */
export class LruStoreImpl<K, V> implements LruStore<K, V> {
  private readonly _store = new Map<K, LruEntry<V>>();
  private readonly _maxItems: number;
  private readonly _defaultTtlMs: number | undefined;
  private readonly _collectStats: boolean;
  private readonly _stats: LruStats;

  constructor(options: LruStoreOptions & { collectStats?: boolean }) {
    this._maxItems = options.maxItems;
    this._defaultTtlMs = options.defaultTtlMs;
    this._collectStats = options.collectStats ?? false;
    this._stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };

    if (this._maxItems <= 0) {
      throw new Error('maxItems must be greater than 0');
    }
  }

  get(key: K): V | undefined {
    const entry = this._store.get(key);

    if (!entry) {
      if (this._collectStats) {
        this._stats.misses++;
      }
      return undefined;
    }

    if (this._isExpired(entry)) {
      this._store.delete(key);
      if (this._collectStats) {
        this._stats.expirations++;
        this._stats.misses++;
      }
      return undefined;
    }

    this._moveToEnd(key, entry);

    if (this._collectStats) {
      this._stats.hits++;
    }

    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this._defaultTtlMs;

    const entry: LruEntry<V> = {
      value,
    };

    if (effectiveTtl !== undefined) {
      entry.expiresAt = Date.now() + effectiveTtl;
    }

    if (this._store.has(key)) {
      this._store.delete(key);
    }

    this._store.set(key, entry);

    if (this._store.size > this._maxItems) {
      this._evictLeastRecentlyUsed();
    }
  }

  delete(key: K): boolean {
    return this._store.delete(key);
  }

  has(key: K): boolean {
    const entry = this._store.get(key);

    if (!entry) {
      return false;
    }

    if (this._isExpired(entry)) {
      this._store.delete(key);
      if (this._collectStats) {
        this._stats.expirations++;
      }
      return false;
    }

    return true;
  }

  *keys(): IterableIterator<K> {
    const expiredKeys: K[] = [];
    const validKeys: K[] = [];

    for (const [key, entry] of this._store) {
      if (this._isExpired(entry)) {
        expiredKeys.push(key);
      } else {
        validKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this._store.delete(key);
      if (this._collectStats) {
        this._stats.expirations++;
      }
    }

    for (const key of validKeys) {
      yield key;
    }
  }

  *values(): IterableIterator<V> {
    const expiredKeys: K[] = [];
    const validValues: V[] = [];

    for (const [key, entry] of this._store) {
      if (this._isExpired(entry)) {
        expiredKeys.push(key);
      } else {
        validValues.push(entry.value);
      }
    }

    for (const key of expiredKeys) {
      this._store.delete(key);
      if (this._collectStats) {
        this._stats.expirations++;
      }
    }

    for (const value of validValues) {
      yield value;
    }
  }

  get size(): number {
    this._cleanupExpired();
    return this._store.size;
  }

  clear(): void {
    this._store.clear();
    if (this._collectStats) {
      this._stats.hits = 0;
      this._stats.misses = 0;
      this._stats.evictions = 0;
      this._stats.expirations = 0;
    }
  }

  stats(): LruStats | undefined {
    return this._collectStats ? { ...this._stats } : undefined;
  }

  private _isExpired(entry: LruEntry<V>): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }

  private _moveToEnd(key: K, entry: LruEntry<V>): void {
    this._store.delete(key);
    this._store.set(key, entry);
  }

  private _evictLeastRecentlyUsed(): void {
    const firstKey = this._store.keys().next().value;
    if (firstKey !== undefined) {
      this._store.delete(firstKey);
      if (this._collectStats) {
        this._stats.evictions++;
      }
    }
  }

  private _cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, entry] of this._store) {
      if (entry.expiresAt !== undefined && now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this._store.delete(key);
      if (this._collectStats) {
        this._stats.expirations++;
      }
    }
  }
}
