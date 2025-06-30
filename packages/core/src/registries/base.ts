import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';

/**
 * Base registry interface that all domain-specific registries must implement
 */
export interface Registry {
  /**
   * Registry type identifier for capability negotiation
   */
  readonly kind: string;

  /**
   * Get capabilities that this registry provides for MCP handshake
   */
  getCapabilities(): Partial<ServerCapabilities>;
}
