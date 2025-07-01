import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry, RegistryMetadata, RegistryStats } from './base';
import { REGISTRY_KINDS } from './base';
import type { HandlerContext, PromptDefinition } from './types';

/**
 * Registry for managing prompt handlers
 */
export class PromptRegistry implements Registry {
  public readonly kind = REGISTRY_KINDS.PROMPTS;
  private readonly _prompts = new Map<string, PromptDefinition>();
  private readonly _stats: RegistryStats = {
    totalRegistered: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };

  /**
   * Register a prompt handler
   */
  register(definition: PromptDefinition): void {
    if (this._prompts.has(definition.name)) {
      throw new Error(`Prompt '${definition.name}' is already registered`);
    }
    this._prompts.set(definition.name, definition);
    this._stats.totalRegistered = this._prompts.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Dispatch a prompt request
   */
  async dispatch(name: string, args: Record<string, unknown>, context: HandlerContext): Promise<string | AsyncIterable<string>> {
    const definition = this._prompts.get(name);
    if (!definition) {
      throw new Error(`Prompt '${name}' not found`);
    }

    if (definition.inputSchema) {
      try {
        definition.inputSchema.parse(args);
      } catch (error) {
        throw new Error(`Invalid input for prompt '${name}': ${error}`);
      }
    }
    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: { promptName: name },
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
   * List all registered prompts
   */
  list(): Array<{ name: string; description?: string }> {
    return Array.from(this._prompts.values()).map(({ name, description }) => {
      const result: { name: string; description?: string } = { name };
      if (description !== undefined) {
        result.description = description;
      }
      return result;
    });
  }

  /**
   * Check if a prompt is registered
   */
  has(name: string): boolean {
    return this._prompts.has(name);
  }

  /**
   * Get the number of registered prompts
   */
  size(): number {
    return this._prompts.size;
  }

  /**
   * Check if the registry is empty
   */
  isEmpty(): boolean {
    return this._prompts.size === 0;
  }

  /**
   * Clear all registered prompts
   */
  clear(): void {
    this._prompts.clear();
    this._stats.totalRegistered = 0;
    this._stats.lastOperation = new Date();
  }

  /**
   * Get registry metadata
   */
  getMetadata(): RegistryMetadata {
    const debug: RegistryMetadata['debug'] = {
      registeredCount: this._prompts.size,
      promptNames: Array.from(this._prompts.keys()),
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Prompt Registry',
      description: 'Registry for managing prompt handlers with Zod validation and streaming support',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    return {
      ...this._stats,
      totalRegistered: this._prompts.size,
      customMetrics: {
        promptsWithSchema: Array.from(this._prompts.values()).filter((p) => p.inputSchema).length,
        promptsWithDescription: Array.from(this._prompts.values()).filter((p) => p.description).length,
      },
    };
  }

  /**
   * Get capabilities for MCP handshake
   */
  getCapabilities(): Partial<ServerCapabilities> {
    if (this._prompts.size === 0) {
      return {};
    }

    return {
      prompts: {},
    };
  }
}
