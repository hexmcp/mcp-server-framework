import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry } from './base';
import type { HandlerContext, ToolDefinition } from './types';

/**
 * Registry for managing tool handlers
 */
export class ToolRegistry implements Registry {
  public readonly kind = 'tools';
  private readonly _tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool handler
   */
  register(definition: ToolDefinition): void {
    if (this._tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }
    this._tools.set(definition.name, definition);
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

    return definition.handler(args, enhancedContext);
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
   * Clear all registered tools
   */
  clear(): void {
    this._tools.clear();
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
