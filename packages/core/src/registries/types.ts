import type { z } from 'zod';
import type { RequestContext } from '../middleware/types';
import type { RegistryKind } from './base';

/**
 * Handler execution context with timing and performance metrics
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
 * Handler context that includes middleware request context
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
 * Enhanced prompt definition for registration
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
 * Enhanced tool definition for registration
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
 * Enhanced resource definition for registration
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
