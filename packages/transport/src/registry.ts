import type { ServerTransport } from './types';

/**
 * Internal transport registry for managing multiple ServerTransport instances.
 *
 * This class provides a centralized registry for collecting and managing
 * ServerTransport instances. It's designed to be used internally by the
 * orchestration layer and future builder DSL patterns.
 *
 * Key features:
 * - Prevents duplicate transport registration using Set semantics
 * - Provides safe iteration over registered transports
 * - Maintains transport collection integrity
 * - Designed for future builder pattern integration
 *
 * Future Integration Points:
 * - Builder DSL: `builder.transport(transport)` will call `registry.registerTransport(transport)`
 * - Server Lifecycle: Server start/stop will use orchestrator functions with this registry
 * - Transport Discovery: Future transport auto-discovery can populate this registry
 * - Configuration: Future config-based transport setup will use this registry
 *
 * TODO: Integration with builder DSL pattern
 * TODO: Integration with server lifecycle management
 * TODO: Support for transport configuration and auto-discovery
 *
 * @internal This class is not exported from the main package index
 */
export class TransportRegistry {
  private readonly _transports = new Set<ServerTransport>();

  /**
   * Register a ServerTransport instance with the registry.
   *
   * Transports are stored in a Set to prevent duplicates. The same transport
   * instance can only be registered once. This method is idempotent - calling
   * it multiple times with the same transport has no additional effect.
   *
   * @param transport - The ServerTransport instance to register
   * @throws {Error} If transport is null or undefined
   *
   * @example
   * ```typescript
   * const registry = new TransportRegistry();
   * const transport = new MockTransport({ name: "test" });
   * registry.registerTransport(transport);
   *
   * // Future builder integration:
   * // builder.transport(transport) -> registry.registerTransport(transport)
   * ```
   */
  registerTransport(transport: ServerTransport): void {
    if (!transport) {
      throw new Error('Transport cannot be null or undefined');
    }

    this._transports.add(transport);
  }

  /**
   * Get all registered transports as a readonly array.
   *
   * Returns a new array containing all registered transports, preserving
   * the original Set integrity while allowing safe iteration by orchestration
   * functions and future server lifecycle management.
   *
   * @returns A readonly array of all registered ServerTransport instances
   *
   * @example
   * ```typescript
   * const transports = registry.getTransports();
   * console.log(`Registered ${transports.length} transports`);
   *
   * // Used by orchestrator:
   * await startAllTransports(registry, dispatch);
   * ```
   */
  getTransports(): readonly ServerTransport[] {
    return Array.from(this._transports);
  }

  /**
   * Check if a specific transport is registered.
   *
   * Useful for conditional registration and avoiding duplicate transport
   * setup in complex initialization scenarios.
   *
   * @param transport - The ServerTransport instance to check
   * @returns True if the transport is registered, false otherwise
   *
   * @example
   * ```typescript
   * const isRegistered = registry.hasTransport(transport);
   * if (!isRegistered) {
   *   registry.registerTransport(transport);
   * }
   * ```
   */
  hasTransport(transport: ServerTransport): boolean {
    return this._transports.has(transport);
  }

  /**
   * Remove a transport from the registry.
   *
   * This method allows for dynamic transport management, enabling transports
   * to be removed from the registry without affecting other registered transports.
   * Useful for hot-swapping transports or graceful transport removal.
   *
   * @param transport - The ServerTransport instance to remove
   * @returns True if the transport was removed, false if it wasn't registered
   *
   * @example
   * ```typescript
   * const removed = registry.unregisterTransport(transport);
   * if (removed) {
   *   console.log('Transport removed successfully');
   * }
   * ```
   */
  unregisterTransport(transport: ServerTransport): boolean {
    return this._transports.delete(transport);
  }

  /**
   * Get the number of registered transports.
   *
   * Useful for validation, logging, and ensuring minimum transport requirements
   * are met before server startup.
   *
   * @returns The count of registered transports
   *
   * @example
   * ```typescript
   * console.log(`Registry contains ${registry.size} transports`);
   *
   * // Future server validation:
   * if (registry.size === 0) {
   *   throw new Error('At least one transport must be registered');
   * }
   * ```
   */
  get size(): number {
    return this._transports.size;
  }

  /**
   * Clear all registered transports.
   *
   * This method removes all transports from the registry, useful for
   * testing scenarios, complete system resets, or server shutdown cleanup.
   *
   * @example
   * ```typescript
   * registry.clear();
   * console.log(`Registry now contains ${registry.size} transports`); // 0
   * ```
   */
  clear(): void {
    this._transports.clear();
  }

  /**
   * Create an iterator for registered transports.
   *
   * Allows for-of iteration over registered transports while maintaining
   * Set semantics and preventing external modification. This enables
   * functional programming patterns and clean iteration in orchestration code.
   *
   * @returns An iterator for the registered transports
   *
   * @example
   * ```typescript
   * for (const transport of registry) {
   *   console.log(`Transport: ${transport.name}`);
   * }
   *
   * // Functional style:
   * const transportNames = Array.from(registry).map(t => t.name);
   * ```
   */
  [Symbol.iterator](): Iterator<ServerTransport> {
    return this._transports[Symbol.iterator]();
  }
}
