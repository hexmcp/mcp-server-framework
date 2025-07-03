import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { Registry, RegistryMetadata, RegistryStats } from './base';
import { REGISTRY_KINDS } from './base';
import type { HandlerContext, ToolDefinition } from './types';

/**
 * Registry for managing tool handlers in the MCP Server Framework.
 *
 * Tools are functions that clients can call to perform specific operations.
 * This registry manages tool registration, validation, execution, and capability
 * negotiation for the MCP protocol.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * registry.register({
 *   name: 'calculate',
 *   description: 'Perform mathematical calculations',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       expression: { type: 'string' }
 *     }
 *   },
 *   handler: async ({ expression }) => {
 *     const result = eval(expression);
 *     return { content: [{ type: 'text', text: String(result) }] };
 *   }
 * });
 * ```
 *
 * @example Advanced tool registry patterns
 * ```typescript
 * // 1. Tool composition and chaining
 * const registry = new ToolRegistry();
 *
 * // Register individual tools
 * registry.register({
 *   name: 'fetch-data',
 *   description: 'Fetch data from external API',
 *   parameters: [
 *     { name: 'url', type: 'string', required: true },
 *     { name: 'headers', type: 'object', required: false }
 *   ],
 *   handler: async (args) => {
 *     const response = await fetch(args.url, { headers: args.headers });
 *     return { content: [{ type: 'text', text: await response.text() }] };
 *   }
 * });
 *
 * registry.register({
 *   name: 'process-data',
 *   description: 'Process and transform data',
 *   parameters: [
 *     { name: 'data', type: 'string', required: true },
 *     { name: 'format', type: 'string', enum: ['json', 'csv', 'xml'], required: true }
 *   ],
 *   handler: async (args) => {
 *     const processed = transformData(args.data, args.format);
 *     return { content: [{ type: 'text', text: processed }] };
 *   }
 * });
 *
 * // Register a composite tool that uses other tools
 * registry.register({
 *   name: 'fetch-and-process',
 *   description: 'Fetch data from API and process it',
 *   parameters: [
 *     { name: 'url', type: 'string', required: true },
 *     { name: 'format', type: 'string', enum: ['json', 'csv', 'xml'], required: true }
 *   ],
 *   handler: async (args, context) => {
 *     // Use other tools in the registry
 *     const fetchResult = await registry.dispatch('fetch-data', { url: args.url }, context);
 *     const processResult = await registry.dispatch('process-data', {
 *       data: fetchResult.content[0].text,
 *       format: args.format
 *     }, context);
 *
 *     return {
 *       content: [
 *         { type: 'text', text: 'Data fetched and processed successfully' },
 *         { type: 'text', text: processResult.content[0].text }
 *       ]
 *     };
 *   }
 * });
 *
 * // 2. Authorization and security patterns
 * const createSecureToolRegistry = () => {
 *   const registry = new ToolRegistry();
 *
 *   registry.register({
 *     name: 'admin-operation',
 *     description: 'Administrative operation requiring elevated privileges',
 *     dangerous: true,
 *     scopes: ['admin', 'system'],
 *     parameters: [{ name: 'action', type: 'string', required: true }],
 *     hooks: {
 *       beforeExecution: async (args, context) => {
 *         // Verify user has required permissions
 *         const userRoles = context.user?.roles || [];
 *         const requiredScopes = ['admin', 'system'];
 *
 *         if (!requiredScopes.some(scope => userRoles.includes(scope))) {
 *           throw new Error(`Insufficient permissions. Required: ${requiredScopes.join(' or ')}`);
 *         }
 *
 *         // Log security-sensitive operation
 *         console.log(`Admin operation ${args.action} initiated by user ${context.user?.id}`);
 *       },
 *       afterExecution: async (result, context) => {
 *         // Audit log
 *         console.log(`Admin operation completed by user ${context.user?.id}`);
 *       }
 *     },
 *     handler: async (args, context) => {
 *       return performAdminOperation(args.action, context.user);
 *     }
 *   });
 *
 *   return registry;
 * };
 * ```
 *
 * @public
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
   * Register a tool handler with validation
   */
  register(definition: ToolDefinition): void {
    const validation = this.validateDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid tool definition: ${validation.errors.join(', ')}`);
    }

    if (this._tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }

    this._tools.set(definition.name, definition);
    this._stats.totalRegistered = this._tools.size;
    this._stats.lastOperation = new Date();
  }

  /**
   * Execute a tool with enhanced validation and authorization
   */
  async execute(name: string, args: Record<string, unknown>, context: HandlerContext, scope?: string): Promise<unknown> {
    const definition = this._tools.get(name);
    if (!definition) {
      throw new Error(`Tool '${name}' not found`);
    }

    await this._checkAuthorization(definition, context, scope);

    await this._validateInput(definition, args);

    const enhancedContext: HandlerContext = {
      ...context,
      registry: {
        kind: this.kind,
        metadata: {
          toolName: name,
          version: definition.version,
          tags: definition.tags,
          dangerous: definition.dangerous,
          scopes: definition.scopes,
          scope: definition.scope,
          throttle: definition.throttle,
          rateLimit: definition.rateLimit,
        },
      },
      execution: {
        executionId: `tool-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date(),
        ...(context.execution?.timeout !== undefined && { timeout: context.execution.timeout }),
        metadata: { toolName: name },
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
   * Check authorization for tool execution
   */
  private async _checkAuthorization(definition: ToolDefinition, context: HandlerContext, scope?: string): Promise<void> {
    if (definition.scopes && definition.scopes.length > 0) {
      const userScopes = context.user?.permissions || [];
      const hasRequiredScope = definition.scopes.some((requiredScope) => userScopes.includes(requiredScope));

      if (!hasRequiredScope) {
        throw new Error(
          `Tool '${definition.name}' requires one of scopes [${definition.scopes.join(', ')}] but user has [${userScopes.join(', ')}]`
        );
      }
    } else if (definition.scope && definition.scope !== scope) {
      throw new Error(`Tool '${definition.name}' requires scope '${definition.scope}' but got '${scope || 'none'}'`);
    }

    if (definition.dangerous && !context.user?.permissions?.includes('dangerous-tools')) {
      throw new Error(`Tool '${definition.name}' is marked as dangerous and requires 'dangerous-tools' permission`);
    }
  }

  /**
   * Validate input using multiple validation methods
   */
  private async _validateInput(definition: ToolDefinition, args: Record<string, unknown>): Promise<void> {
    if (definition.validate) {
      const result = definition.validate(args);
      if (!result.success) {
        const errorMessages = result.errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Validation failed';
        throw new Error(`Invalid input for tool '${definition.name}': ${errorMessages}`);
      }
      return;
    }

    if (definition.inputSchema) {
      try {
        definition.inputSchema.parse(args);
      } catch (error) {
        throw new Error(`Invalid input for tool '${definition.name}': ${error}`);
      }
      return;
    }

    if (definition.parameters) {
      for (const param of definition.parameters) {
        if (param.required && !(param.name in args)) {
          throw new Error(`Missing required parameter '${param.name}' for tool '${definition.name}'`);
        }

        if (param.name in args && param.schema) {
          try {
            param.schema.parse(args[param.name]);
          } catch (error) {
            throw new Error(`Invalid value for parameter '${param.name}' in tool '${definition.name}': ${error}`);
          }
        }

        if (param.name in args && param.enum && param.type === 'string') {
          const value = args[param.name];
          if (typeof value === 'string' && !param.enum.includes(value)) {
            throw new Error(`Parameter '${param.name}' must be one of [${param.enum.join(', ')}] but got '${value}'`);
          }
        }
      }
    }
  }

  /**
   * List all registered tools with optional filtering
   */
  list(options?: { tags?: string[]; dangerous?: boolean; withScope?: boolean; withSchema?: boolean }): Array<{
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    dangerous?: boolean;
    scopes?: string[];
    scope?: string;
    throttle?: { maxCalls?: number; windowMs?: number };
    rateLimit?: { maxCalls: number; windowMs: number };
    hasSchema: boolean;
    hasHooks: boolean;
  }> {
    let tools = Array.from(this._tools.values());

    if (options?.tags && options.tags.length > 0) {
      const filterTags = options.tags;
      tools = tools.filter((t) => t.tags && filterTags.some((tag) => t.tags?.includes(tag)));
    }

    if (options?.dangerous !== undefined) {
      tools = tools.filter((t) => t.dangerous === options.dangerous);
    }

    if (options?.withScope !== undefined) {
      const hasScope = (t: ToolDefinition) => !!(t.scope || (t.scopes && t.scopes.length > 0));
      tools = tools.filter((t) => hasScope(t) === options.withScope);
    }

    if (options?.withSchema !== undefined) {
      const hasSchema = (t: ToolDefinition) => !!(t.inputSchema || t.parameters || t.validate);
      tools = tools.filter((t) => hasSchema(t) === options.withSchema);
    }

    return tools.map(
      ({ name, description, tags, version, dangerous, scopes, scope, throttle, rateLimit, inputSchema, parameters, validate, hooks }) => {
        const result: {
          name: string;
          description?: string;
          tags?: string[];
          version?: string;
          dangerous?: boolean;
          scopes?: string[];
          scope?: string;
          throttle?: { maxCalls?: number; windowMs?: number };
          rateLimit?: { maxCalls: number; windowMs: number };
          hasSchema: boolean;
          hasHooks: boolean;
        } = {
          name,
          hasSchema: !!(inputSchema || parameters || validate),
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
        if (dangerous !== undefined) {
          result.dangerous = dangerous;
        }
        if (scopes !== undefined) {
          result.scopes = scopes;
        }
        if (scope !== undefined) {
          result.scope = scope;
        }
        if (throttle !== undefined) {
          result.throttle = throttle;
        }
        if (rateLimit !== undefined) {
          result.rateLimit = rateLimit;
        }

        return result;
      }
    );
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this._tools.has(name);
  }

  /**
   * Get a specific tool definition
   */
  get(name: string): ToolDefinition | undefined {
    return this._tools.get(name);
  }

  /**
   * Get tool names by tags
   */
  getByTags(tags: string[]): string[] {
    return Array.from(this._tools.values())
      .filter((t) => t.tags && tags.some((tag) => t.tags?.includes(tag)))
      .map((t) => t.name);
  }

  /**
   * Get all unique tags from registered tools
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const tool of this._tools.values()) {
      if (tool.tags) {
        for (const tag of tool.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Get tools by scope
   */
  getByScope(scope: string): string[] {
    return Array.from(this._tools.values())
      .filter((t) => t.scope === scope || t.scopes?.includes(scope))
      .map((t) => t.name);
  }

  /**
   * Get dangerous tools
   */
  getDangerousTools(): string[] {
    return Array.from(this._tools.values())
      .filter((t) => t.dangerous)
      .map((t) => t.name);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const existed = this._tools.delete(name);
    if (existed) {
      this._stats.totalRegistered = this._tools.size;
      this._stats.lastOperation = new Date();
    }
    return existed;
  }

  /**
   * Validate a tool definition without registering it
   */
  validateDefinition(definition: ToolDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    } else if (definition.name.trim() !== definition.name) {
      errors.push('Tool name cannot have leading or trailing whitespace');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(definition.name)) {
      errors.push('Tool name can only contain letters, numbers, underscores, and hyphens');
    }

    if (!definition.handler || typeof definition.handler !== 'function') {
      errors.push('Tool handler is required and must be a function');
    }

    if (definition.parameters) {
      for (const [index, param] of definition.parameters.entries()) {
        if (!param.name || typeof param.name !== 'string') {
          errors.push(`Parameter at index ${index} must have a valid name`);
        }
        if (param.required !== undefined && typeof param.required !== 'boolean') {
          errors.push(`Parameter '${param.name}' required property must be a boolean`);
        }
        if (!['string', 'number', 'boolean', 'object', 'array'].includes(param.type)) {
          errors.push(`Parameter '${param.name}' has invalid type '${param.type}'`);
        }
      }
    }

    if (definition.version && !/^\d+\.\d+\.\d+/.test(definition.version)) {
      errors.push('Version must follow semantic versioning format (e.g., 1.0.0)');
    }

    if (definition.scopes && !Array.isArray(definition.scopes)) {
      errors.push('Scopes must be an array of strings');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
      uniqueTags: this.getAllTags(),
      dangerousTools: this.getDangerousTools().length,
      toolsWithScopes: Array.from(this._tools.values()).filter((t) => t.scope || (t.scopes && t.scopes.length > 0)).length,
      toolsWithValidation: Array.from(this._tools.values()).filter((t) => t.inputSchema || t.parameters || t.validate).length,
    };

    if (this._stats.lastOperation) {
      debug.lastModified = this._stats.lastOperation;
    }

    return {
      name: 'Tool Registry',
      description: 'Registry for managing tool handlers with enhanced authorization, validation, and lifecycle hooks',
      debug,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const tools = Array.from(this._tools.values());

    return {
      ...this._stats,
      totalRegistered: this._tools.size,
      customMetrics: {
        toolsWithLegacyScope: tools.filter((t) => t.scope).length,
        toolsWithScopes: tools.filter((t) => t.scopes && t.scopes.length > 0).length,
        toolsWithParameters: tools.filter((t) => t.parameters).length,
        toolsWithCustomValidation: tools.filter((t) => t.validate).length,
        toolsWithSchema: tools.filter((t) => t.inputSchema).length,
        toolsWithDescription: tools.filter((t) => t.description).length,
        toolsWithTags: tools.filter((t) => t.tags && t.tags.length > 0).length,
        toolsWithVersion: tools.filter((t) => t.version).length,
        dangerousTools: tools.filter((t) => t.dangerous).length,
        toolsWithHooks: tools.filter((t) => t.hooks?.beforeExecution || t.hooks?.afterExecution || t.hooks?.onError).length,
        toolsWithCaching: tools.filter((t) => t.cache?.enabled).length,
        toolsWithRateLimit: tools.filter((t) => t.rateLimit).length,
        toolsWithThrottle: tools.filter((t) => t.throttle).length,
        uniqueTags: this.getAllTags().length,
        averageTagsPerTool: tools.length > 0 ? tools.reduce((sum, t) => sum + (t.tags?.length || 0), 0) / tools.length : 0,
        averageScopesPerTool: tools.length > 0 ? tools.reduce((sum, t) => sum + (t.scopes?.length || 0), 0) / tools.length : 0,
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

  /**
   * Get detailed capability information for debugging
   */
  getDetailedCapabilities(): {
    totalTools: number;
    dangerousTools: number;
    toolsWithValidation: number;
    toolsWithHooks: number;
    toolsWithScopes: number;
    uniqueTags: number;
    capabilities: Partial<ServerCapabilities>;
  } {
    const tools = Array.from(this._tools.values());

    return {
      totalTools: tools.length,
      dangerousTools: tools.filter((t) => t.dangerous).length,
      toolsWithValidation: tools.filter((t) => t.inputSchema || t.parameters || t.validate).length,
      toolsWithHooks: tools.filter((t) => t.hooks?.beforeExecution || t.hooks?.afterExecution || t.hooks?.onError).length,
      toolsWithScopes: tools.filter((t) => t.scope || (t.scopes && t.scopes.length > 0)).length,
      uniqueTags: this.getAllTags().length,
      capabilities: this.getCapabilities(),
    };
  }
}
