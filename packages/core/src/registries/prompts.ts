import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry } from './base';
import type { HandlerContext, PromptDefinition } from './types';

/**
 * Registry for managing prompt handlers
 */
export class PromptRegistry implements Registry {
  public readonly kind = 'prompts';
  private readonly _prompts = new Map<string, PromptDefinition>();

  /**
   * Register a prompt handler
   */
  register(definition: PromptDefinition): void {
    if (this._prompts.has(definition.name)) {
      throw new Error(`Prompt '${definition.name}' is already registered`);
    }
    this._prompts.set(definition.name, definition);
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

    return definition.handler(args, enhancedContext);
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
   * Clear all registered prompts
   */
  clear(): void {
    this._prompts.clear();
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
