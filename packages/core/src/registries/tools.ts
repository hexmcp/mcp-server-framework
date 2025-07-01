import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry, RegistryMetadata, RegistryStats } from './base';
import { REGISTRY_KINDS } from './base';
import type { HandlerContext, ToolDefinition } from './types';

/**
 * Registry for managing tool handlers
 */
export class ToolRegistry implements Registry {
  public readonly kind = REGISTRY_KINDS.TOOLS;
  private readonly _tools = new Map<string, ToolDefinition>();
  private readonly _stats: RegistryStats = {
    totalRegistered: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };

  /**
   * Register a tool handler
   */
  register(definition: ToolDefinition): void {
    if (this._tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }
    this._tools.set(definition.name, definition);
    this._stats.totalRegistered = this._tools.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Execute a tool
   */
  async execute(name: string, args: Record<string, unknown>, context: HandlerContext, scope?: string): Promise<unknown> {
    const definition = this._tools.get(name);
    if (!definition) {
      throw new Error(`Tool '${name}' not found`);
    }

    if (definition.scope && definition.scope !== scope) {
      throw new Error(`Tool '${name}' requires scope '${definition.scope}' but got '${scope || 'none'}'`);
    }

    if (definition.inputSchema) {
      try {
        definition.inputSchema.parse(args);
      } catch (error) {
        throw new Error(`Invalid input for tool '${name}': ${error}`);
      }
    }
    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: {
          toolName: name,
          scope: definition.scope,
          throttle: definition.throttle,
        },
      },
    };

    try {
      const result = await definition.handler(args, enhancedContext);
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
   * List all registered tools
   */
  list(): Array<{
    name: string;
    description?: string;
    scope?: string;
    throttle?: { maxCalls?: number; windowMs?: number };
  }> {
    return Array.from(this._tools.values()).map(({ name, description, scope, throttle }) => {
      const result: {
        name: string;
        description?: string;
        scope?: string;
        throttle?: { maxCalls?: number; windowMs?: number };
      } = { name };
      if (description !== undefined) {
        result.description = description;
      }
      if (scope !== undefined) {
        result.scope = scope;
      }
      if (throttle !== undefined) {
        result.throttle = throttle;
      }
      return result;
    });
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this._tools.has(name);
  }

  /**
   * Get the number of registered tools
   */
  size(): number {
    return this._tools.size;
  }

  /**
   * Check if the registry is empty
   */
  isEmpty(): boolean {
    return this._tools.size === 0;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this._tools.clear();
    this._stats.totalRegistered = 0;
    this._stats.lastOperation = new Date();
  }

  /**
   * Get registry metadata
   */
  getMetadata(): RegistryMetadata {
    const debug: RegistryMetadata['debug'] = {
      registeredCount: this._tools.size,
      toolNames: Array.from(this._tools.keys()),
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Tool Registry',
      description: 'Registry for managing tool handlers with scope authorization and throttle metadata',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    return {
      ...this._stats,
      totalRegistered: this._tools.size,
      customMetrics: {
        toolsWithScope: Array.from(this._tools.values()).filter((t) => t.scope).length,
        toolsWithThrottle: Array.from(this._tools.values()).filter((t) => t.throttle).length,
        toolsWithSchema: Array.from(this._tools.values()).filter((t) => t.inputSchema).length,
      },
    };
  }

  /**
   * Get capabilities for MCP handshake
   */
  getCapabilities(): Partial<ServerCapabilities> {
    if (this._tools.size === 0) {
      return {};
    }

    return {
      tools: {},
    };
  }
}
