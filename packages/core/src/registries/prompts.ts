import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry, RegistryMetadata, RegistryStats } from './base';
import { REGISTRY_KINDS } from './base';
import type { HandlerContext, PromptContent, PromptDefinition } from './types';

/**
 * Registry for managing prompt handlers with enhanced validation, streaming support, and lifecycle hooks.
 *
 * The PromptRegistry provides a comprehensive system for registering, validating, and executing
 * prompt handlers in MCP servers. It supports advanced features like streaming responses,
 * input validation, caching, rate limiting, and lifecycle hooks.
 *
 * @example Basic prompt registration
 * ```typescript
 * const registry = new PromptRegistry();
 *
 * registry.register({
 *   name: 'greeting',
 *   description: 'Generate a personalized greeting',
 *   arguments: [
 *     { name: 'name', description: 'Person to greet', required: true }
 *   ],
 *   handler: async (args) => ({
 *     content: [{ type: 'text', text: `Hello, ${args.name}!` }]
 *   })
 * });
 * ```
 *
 * @example Streaming prompt with validation
 * ```typescript
 * registry.register({
 *   name: 'story-generator',
 *   description: 'Generate a story with streaming output',
 *   streaming: true,
 *   arguments: [
 *     { name: 'topic', description: 'Story topic', required: true },
 *     { name: 'length', description: 'Story length', required: false }
 *   ],
 *   validate: (args) => {
 *     if (typeof args.topic !== 'string' || args.topic.length < 3) {
 *       return { success: false, errors: [{ path: ['topic'], message: 'Topic must be at least 3 characters' }] };
 *     }
 *     return { success: true };
 *   },
 *   handler: async function* (args) {
 *     for (const chunk of generateStoryChunks(args.topic)) {
 *       yield { content: [{ type: 'text', text: chunk }] };
 *     }
 *   }
 * });
 * ```
 *
 * @example With lifecycle hooks and caching
 * ```typescript
 * registry.register({
 *   name: 'expensive-computation',
 *   description: 'Perform expensive computation with caching',
 *   cache: {
 *     enabled: true,
 *     ttl: 300000, // 5 minutes
 *     key: (args) => `computation-${JSON.stringify(args)}`
 *   },
 *   hooks: {
 *     beforeExecution: async (args, context) => {
 *       console.log(`Starting computation for user ${context.user?.id}`);
 *     },
 *     afterExecution: async (result, context) => {
 *       console.log(`Computation completed in ${context.execution?.duration}ms`);
 *     },
 *     onError: async (error, context) => {
 *       console.error(`Computation failed: ${error.message}`);
 *     }
 *   },
 *   handler: async (args) => {
 *     // Expensive computation logic
 *     return { content: [{ type: 'text', text: 'Result' }] };
 *   }
 * });
 * ```
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
   * Register a prompt handler with comprehensive validation.
   *
   * Validates the prompt definition and registers it for execution. The prompt name
   * must be unique within the registry. Supports various validation methods including
   * Zod schemas, argument definitions, and custom validation functions.
   *
   * @param definition - The prompt definition to register
   * @throws {Error} When the definition is invalid or the prompt name is already registered
   *
   * @example Register a simple prompt
   * ```typescript
   * registry.register({
   *   name: 'echo',
   *   description: 'Echo the input message',
   *   arguments: [{ name: 'message', description: 'Message to echo', required: true }],
   *   handler: async (args) => ({ content: [{ type: 'text', text: args.message }] })
   * });
   * ```
   *
   * @example Register with validation and streaming
   * ```typescript
   * registry.register({
   *   name: 'chat',
   *   description: 'Chat with AI assistant',
   *   streaming: true,
   *   validate: (args) => {
   *     if (!args.message || typeof args.message !== 'string') {
   *       return { success: false, errors: [{ path: ['message'], message: 'Message is required' }] };
   *     }
   *     return { success: true };
   *   },
   *   handler: async function* (args) {
   *     for (const chunk of generateResponse(args.message)) {
   *       yield { content: [{ type: 'text', text: chunk }] };
   *     }
   *   }
   * });
   * ```
   */
  register(definition: PromptDefinition): void {
    const validation = this.validateDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid prompt definition: ${validation.errors.join(', ')}`);
    }

    if (this._prompts.has(definition.name)) {
      throw new Error(`Prompt '${definition.name}' is already registered`);
    }

    this._prompts.set(definition.name, definition);
    this._stats.totalRegistered = this._prompts.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Dispatch a prompt request to the registered handler.
   *
   * Executes the prompt handler with the provided arguments and context. Performs
   * input validation, executes lifecycle hooks, and handles both streaming and
   * non-streaming responses. The execution context is enhanced with registry
   * metadata and execution tracking information.
   *
   * @param name - The name of the prompt to execute
   * @param args - Arguments to pass to the prompt handler
   * @param context - Execution context containing user info, transport details, etc.
   * @returns Promise resolving to the prompt content (text, images, etc.)
   * @throws {Error} When the prompt is not found or validation fails
   *
   * @example Execute a simple prompt
   * ```typescript
   * const result = await registry.dispatch('greeting',
   *   { name: 'Alice' },
   *   { user: { id: 'user123' }, transport: { name: 'stdio' } }
   * );
   * console.log(result.content); // [{ type: 'text', text: 'Hello, Alice!' }]
   * ```
   *
   * @example Execute with timeout and metadata
   * ```typescript
   * const result = await registry.dispatch('complex-prompt',
   *   { query: 'analyze data' },
   *   {
   *     user: { id: 'user123', permissions: ['read'] },
   *     transport: { name: 'websocket' },
   *     execution: { timeout: 10000 }
   *   }
   * );
   * ```
   */
  async dispatch(name: string, args: Record<string, unknown>, context: HandlerContext): Promise<PromptContent> {
    const definition = this._prompts.get(name);
    if (!definition) {
      throw new Error(`Prompt '${name}' not found`);
    }

    await this._validateInput(definition, args);

    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: {
          promptName: name,
          version: definition.version,
          tags: definition.tags,
          streaming: definition.streaming,
        },
      },
      execution: {
        executionId: `prompt-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date(),
        ...(context.execution?.timeout !== undefined && { timeout: context.execution.timeout }),
        metadata: { promptName: name },
      },
    };

    try {
      if (definition.hooks?.beforeExecution) {
        await definition.hooks.beforeExecution(args, enhancedContext);
      }

      const result = await definition.handler(args, enhancedContext);

      if (definition.hooks?.afterExecution) {
        await definition.hooks.afterExecution(result, enhancedContext);
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
   * Validate input using multiple validation methods
   */
  private async _validateInput(definition: PromptDefinition, args: Record<string, unknown>): Promise<void> {
    if (definition.validate) {
      const result = definition.validate(args);
      if (!result.success) {
        const errorMessages = result.errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Validation failed';
        throw new Error(`Invalid input for prompt '${definition.name}': ${errorMessages}`);
      }
      return;
    }

    if (definition.inputSchema) {
      try {
        definition.inputSchema.parse(args);
      } catch (error) {
        throw new Error(`Invalid input for prompt '${definition.name}': ${error}`);
      }
      return;
    }

    if (definition.arguments) {
      for (const arg of definition.arguments) {
        if (arg.required && !(arg.name in args)) {
          throw new Error(`Missing required argument '${arg.name}' for prompt '${definition.name}'`);
        }

        if (arg.name in args && arg.schema) {
          try {
            arg.schema.parse(args[arg.name]);
          } catch (error) {
            throw new Error(`Invalid value for argument '${arg.name}' in prompt '${definition.name}': ${error}`);
          }
        }
      }
    }
  }

  /**
   * List all registered prompts with optional filtering
   */
  list(options?: { tags?: string[]; streaming?: boolean; withSchema?: boolean }): Array<{
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    streaming?: boolean;
    hasSchema: boolean;
    hasHooks: boolean;
  }> {
    let prompts = Array.from(this._prompts.values());

    if (options?.tags && options.tags.length > 0) {
      const filterTags = options.tags;
      prompts = prompts.filter((p) => p.tags && filterTags.some((tag) => p.tags?.includes(tag)));
    }

    if (options?.streaming !== undefined) {
      prompts = prompts.filter((p) => p.streaming === options.streaming);
    }

    if (options?.withSchema !== undefined) {
      const hasSchema = (p: PromptDefinition) => !!(p.inputSchema || p.arguments || p.validate);
      prompts = prompts.filter((p) => hasSchema(p) === options.withSchema);
    }

    return prompts.map(({ name, description, tags, version, streaming, inputSchema, arguments: args, validate, hooks }) => {
      const result: {
        name: string;
        description?: string;
        tags?: string[];
        version?: string;
        streaming?: boolean;
        hasSchema: boolean;
        hasHooks: boolean;
      } = {
        name,
        hasSchema: !!(inputSchema || args || validate),
        hasHooks: !!(hooks?.beforeExecution || hooks?.afterExecution || hooks?.onError),
      };

      if (description !== undefined) {
        result.description = description;
      }
      if (tags !== undefined) {
        result.tags = tags;
      }
      if (version !== undefined) {
        result.version = version;
      }
      if (streaming !== undefined) {
        result.streaming = streaming;
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
   * Get a specific prompt definition
   */
  get(name: string): PromptDefinition | undefined {
    return this._prompts.get(name);
  }

  /**
   * Get prompt names by tags
   */
  getByTags(tags: string[]): string[] {
    return Array.from(this._prompts.values())
      .filter((p) => p.tags && tags.some((tag) => p.tags?.includes(tag)))
      .map((p) => p.name);
  }

  /**
   * Get all unique tags from registered prompts
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const prompt of this._prompts.values()) {
      if (prompt.tags) {
        for (const tag of prompt.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Unregister a prompt
   */
  unregister(name: string): boolean {
    const existed = this._prompts.delete(name);
    if (existed) {
      this._stats.totalRegistered = this._prompts.size;
      this._stats.lastOperation = new Date();
    }
    return existed;
  }

  /**
   * Validate a prompt definition without registering it
   */
  validateDefinition(definition: PromptDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Prompt name is required and must be a string');
    } else if (definition.name.trim() !== definition.name) {
      errors.push('Prompt name cannot have leading or trailing whitespace');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(definition.name)) {
      errors.push('Prompt name can only contain letters, numbers, underscores, and hyphens');
    }

    if (!definition.handler || typeof definition.handler !== 'function') {
      errors.push('Prompt handler is required and must be a function');
    }

    if (definition.arguments) {
      for (const [index, arg] of definition.arguments.entries()) {
        if (!arg.name || typeof arg.name !== 'string') {
          errors.push(`Argument at index ${index} must have a valid name`);
        }
        if (arg.required !== undefined && typeof arg.required !== 'boolean') {
          errors.push(`Argument '${arg.name}' required property must be a boolean`);
        }
      }
    }

    if (definition.version && !/^\d+\.\d+\.\d+/.test(definition.version)) {
      errors.push('Version must follow semantic versioning format (e.g., 1.0.0)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
      uniqueTags: this.getAllTags(),
      streamingPrompts: Array.from(this._prompts.values()).filter((p) => p.streaming).length,
      promptsWithValidation: Array.from(this._prompts.values()).filter((p) => p.inputSchema || p.arguments || p.validate).length,
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Prompt Registry',
      description: 'Registry for managing prompt handlers with enhanced validation, streaming support, and lifecycle hooks',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const prompts = Array.from(this._prompts.values());

    return {
      ...this._stats,
      totalRegistered: this._prompts.size,
      customMetrics: {
        promptsWithSchema: prompts.filter((p) => p.inputSchema).length,
        promptsWithArguments: prompts.filter((p) => p.arguments).length,
        promptsWithCustomValidation: prompts.filter((p) => p.validate).length,
        promptsWithDescription: prompts.filter((p) => p.description).length,
        promptsWithTags: prompts.filter((p) => p.tags && p.tags.length > 0).length,
        promptsWithVersion: prompts.filter((p) => p.version).length,
        streamingPrompts: prompts.filter((p) => p.streaming).length,
        promptsWithHooks: prompts.filter((p) => p.hooks?.beforeExecution || p.hooks?.afterExecution || p.hooks?.onError).length,
        promptsWithCaching: prompts.filter((p) => p.cache?.enabled).length,
        promptsWithRateLimit: prompts.filter((p) => p.rateLimit).length,
        uniqueTags: this.getAllTags().length,
        averageTagsPerPrompt: prompts.length > 0 ? prompts.reduce((sum, p) => sum + (p.tags?.length || 0), 0) / prompts.length : 0,
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

    const hasStreamingPrompts = Array.from(this._prompts.values()).some((p) => p.streaming);

    return {
      prompts: {
        ...(hasStreamingPrompts && { streaming: true }),
      },
    };
  }

  /**
   * Get detailed capability information for debugging
   */
  getDetailedCapabilities(): {
    totalPrompts: number;
    streamingPrompts: number;
    promptsWithValidation: number;
    promptsWithHooks: number;
    uniqueTags: number;
    capabilities: Partial<ServerCapabilities>;
  } {
    const prompts = Array.from(this._prompts.values());

    return {
      totalPrompts: prompts.length,
      streamingPrompts: prompts.filter((p) => p.streaming).length,
      promptsWithValidation: prompts.filter((p) => p.inputSchema || p.arguments || p.validate).length,
      promptsWithHooks: prompts.filter((p) => p.hooks?.beforeExecution || p.hooks?.afterExecution || p.hooks?.onError).length,
      uniqueTags: this.getAllTags().length,
      capabilities: this.getCapabilities(),
    };
  }
}
