import type { z } from 'zod';
import type { RequestContext } from '../middleware/types';

/**
 * Handler context that includes middleware request context
 */
export interface HandlerContext extends RequestContext {
  /**
   * Additional registry-specific metadata
   */
  registry?: {
    kind: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Prompt definition for registration
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
   * Zod schema for input validation
   */
  inputSchema?: z.ZodSchema;

  /**
   * Prompt handler function
   */
  handler: (args: Record<string, unknown>, context: HandlerContext) => Promise<string | AsyncIterable<string>>;
}

/**
 * Tool definition for registration
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
   * Zod schema for input validation
   */
  inputSchema?: z.ZodSchema;

  /**
   * Optional scope for authorization
   */
  scope?: string;

  /**
   * Throttle metadata for rate limiting
   */
  throttle?: {
    maxCalls?: number;
    windowMs?: number;
  };

  /**
   * Tool handler function
   */
  handler: (args: Record<string, unknown>, context: HandlerContext) => Promise<unknown>;
}

/**
 * Resource provider interface
 */
export interface ResourceProvider {
  /**
   * Get a specific resource by URI
   */
  get(uri: string, context: HandlerContext): Promise<unknown>;

  /**
   * List available resources with optional pagination
   */
  list(
    cursor?: string,
    context?: HandlerContext
  ): Promise<{
    resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
    nextCursor?: string;
  }>;
}

/**
 * Resource definition for registration
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
   * Resource provider implementation
   */
  provider: ResourceProvider;
}
