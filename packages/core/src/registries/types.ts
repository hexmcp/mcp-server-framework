import type { z } from 'zod';
import type { RequestContext } from '../middleware/types';
import type { RegistryKind } from './base';

/**
 * Handler execution context with timing and performance metrics for comprehensive execution tracking.
 *
 * The HandlerExecutionContext provides detailed information about the current handler execution,
 * including unique identifiers for tracing, timing information for performance monitoring,
 * timeout configuration, and extensible metadata for custom tracking requirements.
 *
 * @example Basic execution tracking
 * ```typescript
 * const trackedHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   const execution = context.execution;
 *   const logger = context.logger; // Logger provided by middleware
 *
 *   if (!execution) {
 *     logger.warn('No execution context available');
 *     return { content: [{ type: 'text', text: 'No tracking' }] };
 *   }
 *
 *   const elapsed = Date.now() - execution.startTime.getTime();
 *
 *   // Use structured logging instead of console
 *   logger.info('Execution context tracked', {
 *     executionId: execution.executionId,
 *     startTime: execution.startTime.toISOString(),
 *     elapsedMs: elapsed
 *   });
 *
 *   return { content: [{ type: 'text', text: `Tracked execution ${execution.executionId}` }] };
 * };
 * ```
 *
 * @example Timeout-aware execution
 * ```typescript
 * const timeoutAwareHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   const execution = context.execution;
 *   const timeout = execution?.timeout || 30000; // Default 30 seconds
 *
 *   // Create a timeout promise
 *   const timeoutPromise = new Promise((_, reject) => {
 *     setTimeout(() => reject(new Error('Handler timeout')), timeout);
 *   });
 *
 *   // Race between actual work and timeout
 *   const workPromise = performLongRunningTask(args);
 *
 *   try {
 *     const result = await Promise.race([workPromise, timeoutPromise]);
 *     return { content: [{ type: 'text', text: 'Task completed within timeout' }] };
 *   } catch (error) {
 *     if (error.message === 'Handler timeout') {
 *       console.error(`Handler ${execution?.executionId} timed out after ${timeout}ms`);
 *     }
 *     throw error;
 *   }
 * };
 * ```
 *
 * @example Custom metadata tracking
 * ```typescript
 * const metadataTrackingHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   const execution = context.execution;
 *   if (!execution?.metadata) {
 *     console.warn('No metadata tracking available');
 *     return { content: [{ type: 'text', text: 'No metadata' }] };
 *   }
 *
 *   // Add custom tracking metadata
 *   execution.metadata.inputSize = JSON.stringify(args).length;
 *   execution.metadata.userAgent = context.transport.peer?.userAgent;
 *   execution.metadata.requestMethod = context.request.method;
 *
 *   const result = await processRequest(args);
 *
 *   // Add result metadata
 *   execution.metadata.outputSize = JSON.stringify(result).length;
 *   execution.metadata.processingSteps = result.steps?.length || 0;
 *   execution.metadata.cacheHit = result.fromCache || false;
 *
 *   return result;
 * };
 * ```
 *
 * @see HandlerContext For the complete handler context interface
 */
export interface HandlerExecutionContext {
  /**
   * Unique execution ID for tracing
   */
  executionId: string;

  /**
   * Execution start timestamp
   */
  startTime: Date;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Execution metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Handler context that includes middleware request context with enhanced registry and execution metadata.
 *
 * The HandlerContext extends RequestContext with additional registry-specific information,
 * execution tracking, and user authorization data. This context is passed to all handler
 * functions in prompts, tools, and resources, providing comprehensive access to request
 * state, execution metrics, and authorization information.
 *
 * @example Basic handler context usage
 * ```typescript
 * const toolHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   // Access request information
 *   const { method, id } = context.request;
 *
 *   // Check user authorization
 *   if (!context.user?.permissions?.includes('tool:execute')) {
 *     throw new Error('Insufficient permissions');
 *   }
 *
 *   // Use execution context for tracing with structured logging
 *   const executionId = context.execution?.executionId || 'unknown';
 *   const logger = context.logger; // Logger provided by middleware
 *
 *   logger.info('Tool execution started', {
 *     method,
 *     executionId,
 *     userId: context.user?.id,
 *     permissions: context.user?.permissions
 *   });
 *
 *   return { content: [{ type: 'text', text: 'Tool executed successfully' }] };
 * };
 * ```
 *
 * @example Performance tracking with execution context
 * ```typescript
 * const performanceAwareHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   const startTime = context.execution?.startTime || new Date();
 *   const executionId = context.execution?.executionId;
 *
 *   // Add performance metadata to execution context
 *   if (context.execution?.metadata) {
 *     context.execution.metadata.startTime = startTime.toISOString();
 *     context.execution.metadata.args = args;
 *   }
 *
 *   try {
 *     const result = await performExpensiveOperation(args);
 *
 *     // Track success metrics
 *     if (context.execution?.metadata) {
 *       context.execution.metadata.duration = Date.now() - startTime.getTime();
 *       context.execution.metadata.status = 'success';
 *     }
 *
 *     return result;
 *   } catch (error) {
 *     // Track error metrics
 *     if (context.execution?.metadata) {
 *       context.execution.metadata.duration = Date.now() - startTime.getTime();
 *       context.execution.metadata.status = 'error';
 *       context.execution.metadata.error = error.message;
 *     }
 *     throw error;
 *   }
 * };
 * ```
 *
 * @example Registry-specific context usage
 * ```typescript
 * const registryAwareHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   // Access registry information
 *   const registryKind = context.registry?.kind;
 *   const registryMetadata = context.registry?.metadata;
 *
 *   if (registryKind === 'tools') {
 *     // Tool-specific logic
 *     console.log('Executing tool with registry metadata:', registryMetadata);
 *   } else if (registryKind === 'prompts') {
 *     // Prompt-specific logic
 *     console.log('Executing prompt with registry metadata:', registryMetadata);
 *   }
 *
 *   // Use transport information for protocol-specific handling
 *   const transportName = context.transport.name;
 *   if (transportName === 'stdio') {
 *     // Handle stdio-specific requirements
 *     console.log('Using stdio transport');
 *   }
 *
 *   return { content: [{ type: 'text', text: `Handled by ${registryKind} registry` }] };
 * };
 * ```
 *
 * @example User authorization and role-based access
 * ```typescript
 * const authorizedHandler = async (args: Record<string, unknown>, context: HandlerContext) => {
 *   const user = context.user;
 *
 *   if (!user) {
 *     throw new Error('Authentication required');
 *   }
 *
 *   // Check user roles
 *   const hasAdminRole = user.roles?.includes('admin');
 *   const hasUserRole = user.roles?.includes('user');
 *
 *   // Check specific permissions
 *   const canWrite = user.permissions?.includes('write');
 *   const canRead = user.permissions?.includes('read');
 *
 *   if (args.operation === 'delete' && !hasAdminRole) {
 *     throw new Error('Admin role required for delete operations');
 *   }
 *
 *   if (args.operation === 'write' && !canWrite) {
 *     throw new Error('Write permission required');
 *   }
 *
 *   // Use user metadata for personalization
 *   const userPreferences = user.metadata?.preferences as Record<string, unknown> || {};
 *
 *   return {
 *     content: [{
 *       type: 'text',
 *       text: `Operation ${args.operation} executed for user ${user.id}`
 *     }],
 *     metadata: {
 *       userId: user.id,
 *       userRoles: user.roles,
 *       preferences: userPreferences
 *     }
 *   };
 * };
 * ```
 *
 * @see RequestContext For base context properties and middleware examples
 * @see HandlerExecutionContext For execution tracking details
 */
export interface HandlerContext extends RequestContext {
  /**
   * Additional registry-specific metadata
   */
  registry?: {
    kind: RegistryKind;
    metadata?: Record<string, unknown>;
  };

  /**
   * Execution context for performance tracking
   */
  execution?: HandlerExecutionContext;

  /**
   * User/client information for authorization
   */
  user?: {
    id?: string;
    roles?: string[];
    permissions?: string[];
    metadata?: Record<string, unknown>;
  };
}

/**
 * Validation result for input schemas
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string[];
    message: string;
    code?: string;
  }>;
}

/**
 * Handler result with metadata
 */
export interface HandlerResult<T = unknown> {
  /**
   * The actual result data
   */
  data: T;

  /**
   * Execution metadata
   */
  metadata?: {
    executionTime?: number;
    cacheHit?: boolean;
    warnings?: string[];
    [key: string]: unknown;
  };
}

/**
 * Prompt argument definition aligned with MCP protocol
 */
export interface PromptArgument {
  /**
   * Argument name
   */
  name: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Whether the argument is required
   */
  required?: boolean;

  /**
   * Zod schema for validation
   */
  schema?: z.ZodSchema;
}

/**
 * Prompt response content types
 */
export type PromptContent = string | AsyncIterable<string>;

/**
 * Enhanced prompt definition for registration with comprehensive configuration options.
 *
 * The PromptDefinition interface defines the structure for registering prompt handlers
 * in the MCP server framework. Prompts are templates or generators that produce content
 * based on input arguments. This interface supports advanced features like streaming
 * responses, input validation, caching, rate limiting, and lifecycle hooks.
 *
 * @example Basic prompt definition
 * ```typescript
 * const greetingPrompt: PromptDefinition = {
 *   name: 'greeting',
 *   description: 'Generate a personalized greeting message',
 *   arguments: [
 *     {
 *       name: 'name',
 *       description: 'Name of the person to greet',
 *       required: true
 *     },
 *     {
 *       name: 'style',
 *       description: 'Greeting style (formal, casual, friendly)',
 *       required: false
 *     }
 *   ],
 *   handler: async (args) => ({
 *     content: [
 *       {
 *         type: 'text',
 *         text: `Hello, ${args.name}! ${getGreetingStyle(args.style)}`
 *       }
 *     ]
 *   })
 * };
 * ```
 *
 * @example Streaming prompt with validation
 * ```typescript
 * const storyPrompt: PromptDefinition = {
 *   name: 'story-generator',
 *   description: 'Generate a story with streaming output',
 *   streaming: true,
 *   arguments: [
 *     {
 *       name: 'topic',
 *       description: 'Story topic or theme',
 *       required: true
 *     },
 *     {
 *       name: 'length',
 *       description: 'Desired story length (short, medium, long)',
 *       required: false
 *     }
 *   ],
 *   validate: (args) => {
 *     if (!args.topic || typeof args.topic !== 'string' || args.topic.length < 3) {
 *       return {
 *         success: false,
 *         errors: [{ path: ['topic'], message: 'Topic must be at least 3 characters' }]
 *       };
 *     }
 *     return { success: true };
 *   },
 *   handler: async function* (args) {
 *     const storyChunks = generateStoryChunks(args.topic, args.length);
 *     for (const chunk of storyChunks) {
 *       yield {
 *         content: [{ type: 'text', text: chunk }]
 *       };
 *     }
 *   }
 * };
 * ```
 *
 * @example Prompt with caching and lifecycle hooks
 * ```typescript
 * const researchPrompt: PromptDefinition = {
 *   name: 'research-summary',
 *   description: 'Generate research summary with caching',
 *   cache: {
 *     enabled: true,
 *     ttl: 600000, // 10 minutes
 *     key: (args) => `research-${args.topic}-${args.depth}`
 *   },
 *   rateLimit: {
 *     maxCalls: 5,
 *     windowMs: 60000, // 1 minute
 *     keyGenerator: (context) => context.user?.id || 'anonymous'
 *   },
 *   arguments: [
 *     {
 *       name: 'topic',
 *       description: 'Research topic',
 *       required: true
 *     },
 *     {
 *       name: 'depth',
 *       description: 'Research depth (basic, detailed, comprehensive)',
 *       required: false
 *     }
 *   ],
 *   hooks: {
 *     beforeExecution: async (args, context) => {
 *       const logger = context.logger; // Logger provided by middleware
 *       logger.info('Research task started', {
 *         topic: args.topic,
 *         userId: context.user?.id,
 *         depth: args.depth
 *       });
 *     },
 *     afterExecution: async (result, context) => {
 *       const logger = context.logger; // Logger provided by middleware
 *       logger.info('Research task completed', {
 *         contentBlocks: result.content.length,
 *         userId: context.user?.id
 *       });
 *     },
 *     onError: async (error, context) => {
 *       const logger = context.logger; // Logger provided by middleware
 *       logger.error('Research task failed', {
 *         error: error.message,
 *         userId: context.user?.id
 *       });
 *     }
 *   },
 *   handler: async (args) => {
 *     const summary = await generateResearchSummary(args.topic, args.depth);
 *     return {
 *       content: [
 *         { type: 'text', text: summary.text },
 *         { type: 'image', data: summary.chart, mimeType: 'image/png' }
 *       ]
 *     };
 *   }
 * };
 * ```
 */
export interface PromptDefinition {
  /**
   * Unique prompt name
   */
  name: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Prompt arguments definition
   */
  arguments?: PromptArgument[];

  /**
   * Zod schema for input validation (legacy support)
   */
  inputSchema?: z.ZodSchema;

  /**
   * Tags for categorization and discovery
   */
  tags?: string[];

  /**
   * Version of the prompt
   */
  version?: string;

  /**
   * Whether the prompt supports streaming responses
   */
  streaming?: boolean;

  /**
   * Caching configuration
   */
  cache?: {
    enabled: boolean;
    ttl?: number;
    key?: (args: Record<string, unknown>) => string;
  };

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
    keyGenerator?: (context: HandlerContext) => string;
  };

  /**
   * Prompt handler function
   */
  handler: (args: Record<string, unknown>, context: HandlerContext) => Promise<PromptContent> | PromptContent;

  /**
   * Optional validation function for complex validation logic
   */
  validate?: (args: Record<string, unknown>) => ValidationResult;

  /**
   * Lifecycle hooks
   */
  hooks?: {
    beforeExecution?: (args: Record<string, unknown>, context: HandlerContext) => Promise<void> | void;
    afterExecution?: (result: PromptContent, context: HandlerContext) => Promise<void> | void;
    onError?: (error: Error, context: HandlerContext) => Promise<void> | void;
  };
}

/**
 * Tool parameter definition aligned with MCP protocol
 */
export interface ToolParameter {
  /**
   * Parameter name
   */
  name: string;

  /**
   * Parameter type
   */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Whether the parameter is required
   */
  required?: boolean;

  /**
   * Default value
   */
  default?: unknown;

  /**
   * Zod schema for validation
   */
  schema?: z.ZodSchema;

  /**
   * Enum values for string parameters
   */
  enum?: string[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /**
   * Result content
   */
  content: unknown;

  /**
   * Whether the tool execution was successful
   */
  isError?: boolean;

  /**
   * Execution metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced tool definition for registration with comprehensive configuration options.
 *
 * The ToolDefinition interface defines the structure for registering tool handlers
 * in the MCP server framework. Tools are executable functions that clients can invoke
 * to perform specific operations. This interface supports advanced features like
 * parameter validation, authorization, caching, rate limiting, and lifecycle hooks.
 *
 * @example Basic tool definition
 * ```typescript
 * const echoTool: ToolDefinition = {
 *   name: 'echo',
 *   description: 'Echo back the input message',
 *   parameters: [
 *     {
 *       name: 'message',
 *       description: 'The message to echo back',
 *       required: true,
 *       type: 'string'
 *     }
 *   ],
 *   handler: async (args) => ({
 *     content: [{ type: 'text', text: `Echo: ${args.message}` }]
 *   })
 * };
 * ```
 *
 * @example Advanced tool with validation and authorization
 * ```typescript
 * const deleteFileTool: ToolDefinition = {
 *   name: 'delete-file',
 *   description: 'Delete a file from the filesystem',
 *   dangerous: true,
 *   scopes: ['filesystem:write'],
 *   parameters: [
 *     {
 *       name: 'path',
 *       description: 'Path to the file to delete',
 *       required: true,
 *       type: 'string'
 *     }
 *   ],
 *   validate: (args) => {
 *     if (!args.path || typeof args.path !== 'string') {
 *       return { success: false, errors: [{ path: ['path'], message: 'Path is required' }] };
 *     }
 *     if (args.path.includes('..')) {
 *       return { success: false, errors: [{ path: ['path'], message: 'Path traversal not allowed' }] };
 *     }
 *     return { success: true };
 *   },
 *   handler: async (args, context) => {
 *     if (!context.user?.permissions?.includes('delete')) {
 *       throw new Error('Insufficient permissions');
 *     }
 *     await fs.unlink(args.path);
 *     return { content: [{ type: 'text', text: `File ${args.path} deleted` }] };
 *   },
 *   hooks: {
 *     beforeExecution: async (args, context) => {
 *       console.log(`User ${context.user?.id} attempting to delete ${args.path}`);
 *     },
 *     afterExecution: async (result, context) => {
 *       console.log('File deletion completed successfully');
 *     }
 *   }
 * };
 * ```
 *
 * @example Tool with caching and rate limiting
 * ```typescript
 * const expensiveComputationTool: ToolDefinition = {
 *   name: 'expensive-computation',
 *   description: 'Perform expensive computation with caching',
 *   cache: {
 *     enabled: true,
 *     ttl: 300000, // 5 minutes
 *     key: (args) => `computation-${JSON.stringify(args)}`
 *   },
 *   rateLimit: {
 *     maxCalls: 10,
 *     windowMs: 60000, // 1 minute
 *     keyGenerator: (context) => context.user?.id || 'anonymous'
 *   },
 *   parameters: [
 *     {
 *       name: 'input',
 *       description: 'Input data for computation',
 *       required: true,
 *       type: 'object'
 *     }
 *   ],
 *   handler: async (args) => {
 *     const result = await performExpensiveComputation(args.input);
 *     return { content: [{ type: 'text', text: JSON.stringify(result) }] };
 *   }
 * };
 * ```
 */
export interface ToolDefinition {
  /**
   * Unique tool name
   */
  name: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Tool parameters definition
   */
  parameters?: ToolParameter[];

  /**
   * Zod schema for input validation (legacy support)
   */
  inputSchema?: z.ZodSchema;

  /**
   * Authorization scopes required to execute this tool
   */
  scopes?: string[];

  /**
   * Optional scope for authorization (legacy support)
   */
  scope?: string;

  /**
   * Tags for categorization and discovery
   */
  tags?: string[];

  /**
   * Version of the tool
   */
  version?: string;

  /**
   * Whether the tool is dangerous and requires confirmation
   */
  dangerous?: boolean;

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
    keyGenerator?: (context: HandlerContext) => string;
  };

  /**
   * Throttle metadata for rate limiting (legacy support)
   */
  throttle?: {
    maxCalls?: number;
    windowMs?: number;
  };

  /**
   * Caching configuration
   */
  cache?: {
    enabled: boolean;
    ttl?: number;
    key?: (args: Record<string, unknown>) => string;
  };

  /**
   * Tool handler function
   */
  handler: (args: Record<string, unknown>, context: HandlerContext) => Promise<ToolResult | unknown> | ToolResult | unknown;

  /**
   * Optional validation function for complex validation logic
   */
  validate?: (args: Record<string, unknown>) => ValidationResult;

  /**
   * Lifecycle hooks
   */
  hooks?: {
    beforeExecution?: (args: Record<string, unknown>, context: HandlerContext) => Promise<void> | void;
    afterExecution?: (result: unknown, context: HandlerContext) => Promise<void> | void;
    onError?: (error: Error, context: HandlerContext) => Promise<void> | void;
  };
}

/**
 * Resource metadata aligned with MCP protocol
 */
export interface ResourceMetadata {
  /**
   * Resource URI
   */
  uri: string;

  /**
   * Human-readable name
   */
  name?: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * MIME type of the resource
   */
  mimeType?: string;

  /**
   * Resource size in bytes
   */
  size?: number;

  /**
   * Last modified timestamp
   */
  lastModified?: Date;

  /**
   * Resource tags for categorization
   */
  tags?: string[];

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Resource content with metadata
 */
export interface ResourceContent {
  /**
   * The actual resource data
   */
  data: unknown;

  /**
   * Content metadata
   */
  metadata: ResourceMetadata;

  /**
   * Content encoding
   */
  encoding?: string;

  /**
   * Whether the content is cached
   */
  cached?: boolean;
}

/**
 * Resource list result with pagination
 */
export interface ResourceListResult {
  /**
   * List of resource metadata
   */
  resources: ResourceMetadata[];

  /**
   * Pagination cursor for next page
   */
  nextCursor?: string;

  /**
   * Total count if available
   */
  totalCount?: number;

  /**
   * Whether there are more results
   */
  hasMore?: boolean;
}

/**
 * Enhanced resource provider interface
 */
export interface ResourceProvider {
  /**
   * Get a specific resource by URI
   */
  get(uri: string, context: HandlerContext): Promise<ResourceContent | unknown>;

  /**
   * List available resources with optional pagination
   */
  list(cursor?: string, context?: HandlerContext): Promise<ResourceListResult>;

  /**
   * Check if a resource exists
   */
  exists?(uri: string, context: HandlerContext): Promise<boolean>;

  /**
   * Get resource metadata without content
   */
  getMetadata?(uri: string, context: HandlerContext): Promise<ResourceMetadata>;

  /**
   * Search resources by query
   */
  search?(query: string, context: HandlerContext): Promise<ResourceListResult>;

  /**
   * Watch for resource changes (if supported)
   */
  watch?(uri: string, callback: (event: ResourceChangeEvent) => void): Promise<() => void>;
}

/**
 * Resource change event for watching
 */
export interface ResourceChangeEvent {
  /**
   * Type of change
   */
  type: 'created' | 'updated' | 'deleted';

  /**
   * Resource URI
   */
  uri: string;

  /**
   * Timestamp of change
   */
  timestamp: Date;

  /**
   * Additional event metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced resource definition for registration with comprehensive URI pattern matching and lifecycle management.
 *
 * The ResourceDefinition interface defines the structure for registering resource providers
 * in the MCP server framework. Resources represent external data sources that can be accessed
 * via URI patterns. This interface supports features like streaming content, caching, rate limiting,
 * authorization, search capabilities, and lifecycle hooks for comprehensive resource management.
 *
 * @example Basic file system resource
 * ```typescript
 * const fileSystemResource: ResourceDefinition = {
 *   uriPattern: 'file://**',
 *   name: 'File System',
 *   description: 'Access local file system resources',
 *   mimeType: 'text/plain',
 *   provider: {
 *     get: async (uri) => {
 *       const filePath = uri.replace('file://', '');
 *       const content = await fs.readFile(filePath, 'utf8');
 *       return {
 *         uri,
 *         mimeType: 'text/plain',
 *         text: content
 *       };
 *     },
 *     list: async () => {
 *       const files = await fs.readdir('./');
 *       return {
 *         resources: files.map(file => ({
 *           uri: `file://${file}`,
 *           name: file,
 *           mimeType: 'text/plain'
 *         }))
 *       };
 *     }
 *   }
 * };
 * ```
 *
 * @example API resource with caching and rate limiting
 * ```typescript
 * const apiResource: ResourceDefinition = {
 *   uriPattern: 'api://data/**',
 *   name: 'External API',
 *   description: 'Access external API data with caching',
 *   mimeType: 'application/json',
 *   watchable: true,
 *   searchable: true,
 *   cache: {
 *     enabled: true,
 *     ttl: 300000, // 5 minutes
 *     key: (uri) => `api-${uri.replace('api://', '')}`
 *   },
 *   rateLimit: {
 *     maxCalls: 100,
 *     windowMs: 60000, // 1 minute
 *     keyGenerator: (context) => context.user?.id || 'anonymous'
 *   },
 *   provider: {
 *     get: async (uri, context) => {
 *       const apiPath = uri.replace('api://data/', '');
 *       const response = await fetch(`https://api.example.com/${apiPath}`, {
 *         headers: { 'Authorization': `Bearer ${context.user?.token}` }
 *       });
 *       return {
 *         uri,
 *         mimeType: 'application/json',
 *         text: await response.text()
 *       };
 *     },
 *     list: async (cursor, context) => {
 *       const response = await fetch(`https://api.example.com/list?cursor=${cursor}`);
 *       const data = await response.json();
 *       return {
 *         resources: data.items.map(item => ({
 *           uri: `api://data/${item.id}`,
 *           name: item.name,
 *           description: item.description,
 *           mimeType: 'application/json'
 *         })),
 *         nextCursor: data.nextCursor
 *       };
 *     },
 *     search: async (query, context) => {
 *       const response = await fetch(`https://api.example.com/search?q=${query}`);
 *       const data = await response.json();
 *       return {
 *         resources: data.results.map(item => ({
 *           uri: `api://data/${item.id}`,
 *           name: item.title,
 *           description: item.summary
 *         })),
 *         hasMore: data.hasMore
 *       };
 *     }
 *   }
 * };
 * ```
 *
 * @example Secure resource with validation and hooks
 * ```typescript
 * const secureResource: ResourceDefinition = {
 *   uriPattern: 'secure://private/**',
 *   name: 'Secure Resources',
 *   description: 'Access private resources with authorization',
 *   mimeType: 'application/json',
 *   validateUri: (uri) => {
 *     if (!uri.startsWith('secure://private/')) {
 *       return {
 *         success: false,
 *         errors: [{ path: ['uri'], message: 'Invalid URI format' }]
 *       };
 *     }
 *     if (uri.includes('..')) {
 *       return {
 *         success: false,
 *         errors: [{ path: ['uri'], message: 'Path traversal not allowed' }]
 *       };
 *     }
 *     return { success: true };
 *   },
 *   hooks: {
 *     beforeGet: async (uri, context) => {
 *       console.log(`User ${context.user?.id} accessing ${uri}`);
 *       if (!context.user?.permissions?.includes('read:private')) {
 *         throw new Error('Insufficient permissions');
 *       }
 *     },
 *     afterGet: async (result, context) => {
 *       console.log(`Successfully retrieved resource: ${result.uri}`);
 *     },
 *     onError: async (error, context) => {
 *       console.error(`Resource access failed: ${error.message}`);
 *     }
 *   },
 *   provider: {
 *     get: async (uri, context) => {
 *       const resourceId = uri.replace('secure://private/', '');
 *       const resource = await getSecureResource(resourceId, context.user);
 *       return {
 *         uri,
 *         mimeType: 'application/json',
 *         text: JSON.stringify(resource)
 *       };
 *     },
 *     list: async (cursor, context) => {
 *       const resources = await listAuthorizedResources(context.user, cursor);
 *       return {
 *         resources: resources.items.map(item => ({
 *           uri: `secure://private/${item.id}`,
 *           name: item.name,
 *           description: item.description
 *         })),
 *         nextCursor: resources.nextCursor
 *       };
 *     }
 *   }
 * };
 * ```
 */
export interface ResourceDefinition {
  /**
   * Resource URI pattern or exact URI
   */
  uriPattern: string;

  /**
   * Human-readable name
   */
  name?: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * MIME type of the resource
   */
  mimeType?: string;

  /**
   * Tags for categorization and discovery
   */
  tags?: string[];

  /**
   * Version of the resource definition
   */
  version?: string;

  /**
   * Whether the resource supports watching for changes
   */
  watchable?: boolean;

  /**
   * Whether the resource supports search
   */
  searchable?: boolean;

  /**
   * Caching configuration
   */
  cache?: {
    enabled: boolean;
    ttl?: number;
    key?: (uri: string) => string;
  };

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
    keyGenerator?: (context: HandlerContext) => string;
  };

  /**
   * Resource provider implementation
   */
  provider: ResourceProvider;

  /**
   * Optional validation function for URIs
   */
  validateUri?: (uri: string) => ValidationResult;

  /**
   * Lifecycle hooks
   */
  hooks?: {
    beforeGet?: (uri: string, context: HandlerContext) => Promise<void> | void;
    afterGet?: (result: ResourceContent | unknown, context: HandlerContext) => Promise<void> | void;
    onError?: (error: Error, context: HandlerContext) => Promise<void> | void;
  };
}

/**
 * Common validation schemas using Zod
 */
export interface ValidationSchemas {
  /**
   * Schema for validating prompt arguments
   */
  promptArgs?: z.ZodSchema;

  /**
   * Schema for validating tool parameters
   */
  toolParams?: z.ZodSchema;

  /**
   * Schema for validating resource URIs
   */
  resourceUri?: z.ZodSchema;

  /**
   * Custom validation schemas
   */
  custom?: Record<string, z.ZodSchema>;
}

/**
 * Registry configuration for advanced features
 */
export interface RegistryConfig {
  /**
   * Default validation schemas
   */
  schemas?: ValidationSchemas;

  /**
   * Default caching configuration
   */
  cache?: {
    enabled: boolean;
    defaultTtl: number;
    maxSize?: number;
  };

  /**
   * Default rate limiting configuration
   */
  rateLimit?: {
    enabled: boolean;
    defaultMaxCalls: number;
    defaultWindowMs: number;
  };

  /**
   * Metrics collection configuration
   */
  metrics?: {
    enabled: boolean;
    detailed: boolean;
    retention?: number;
  };

  /**
   * Security configuration
   */
  security?: {
    requireAuth: boolean;
    allowedScopes?: string[];
    dangerousToolsRequireConfirmation: boolean;
  };
}
