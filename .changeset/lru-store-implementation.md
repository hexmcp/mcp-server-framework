---
"@hexmcp/core": minor
---

feat(core): implement LRU store with TTL support and ResourceProvider adapter

Add comprehensive LRU (Least Recently Used) cache implementation with TTL (Time-To-Live) support for efficient resource caching in the MCP server framework.

**New Features:**
- `LruStore<K, V>` interface with O(1) operations (get, set, delete, has, clear)
- `LruStoreImpl` class with Map-based LRU eviction and lazy TTL expiration
- `LruResourceStore<T>` adapter implementing ResourceProvider interface
- `createLruResourceStore<T>()` factory function for easy instantiation
- Optional statistics collection (hits, misses, evictions, expirations)
- Iterator support for keys and values with automatic expired item cleanup

**Key Capabilities:**
- **Efficient Performance**: O(1) core operations using Map insertion order manipulation
- **Lazy TTL Expiration**: Items expire on access without background timers
- **LRU Eviction**: Automatic eviction of least recently used items when capacity exceeded
- **ResourceProvider Integration**: Drop-in replacement for resource caching in ResourceRegistry
- **Configurable Options**: Capacity limits, default TTL, statistics collection, MIME types
- **TypeScript Strict**: Full type safety with proper optional property handling

**Usage Example:**
```typescript
import { createLruResourceStore } from '@hexmcp/core/storage';

// Create LRU cache with capacity and TTL
const resourceCache = createLruResourceStore(100, 5 * 60 * 1000); // 5 minutes TTL

// Use with ResourceRegistry
registry.setResourceProvider('cached-resources', resourceCache);
```

**Internal Module**: This is an internal storage module not exported in the public API, designed for use within the framework's resource management system.

**Test Coverage**: 57 comprehensive tests with 92.59% coverage including performance benchmarking, memory leak prevention, and enterprise-grade stress testing.
