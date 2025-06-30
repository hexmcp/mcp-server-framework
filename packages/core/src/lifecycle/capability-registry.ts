import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { CapabilityRegistry, PrimitiveRegistry } from './types.js';

/**
 * Default server capabilities for MCP servers
 */
const DEFAULT_CAPABILITIES: ServerCapabilities = {
  experimental: {},
  logging: {},
};

/**
 * Implementation of capability registry that dynamically generates
 * server capabilities based on registered primitives
 */
export class McpCapabilityRegistry implements CapabilityRegistry {
  private _capabilities: ServerCapabilities;
  private _primitiveRegistry: PrimitiveRegistry | null = null;

  constructor(initialCapabilities: Partial<ServerCapabilities> = {}) {
    this._capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...initialCapabilities,
    };
  }

  /**
   * Set the primitive registry for dynamic capability detection
   */
  setPrimitiveRegistry(registry: PrimitiveRegistry): void {
    this._primitiveRegistry = registry;
  }

  /**
   * Get current server capabilities, dynamically updated based on registered primitives
   */
  getServerCapabilities(): ServerCapabilities {
    const capabilities = { ...this._capabilities };

    if (this._primitiveRegistry) {
      // Add prompts capability if prompts are registered
      if (this._primitiveRegistry.hasPrompts()) {
        capabilities.prompts = capabilities.prompts || {};
      }

      // Add tools capability if tools are registered
      if (this._primitiveRegistry.hasTools()) {
        capabilities.tools = capabilities.tools || {};
      }

      // Add resources capability if resources are registered
      if (this._primitiveRegistry.hasResources()) {
        capabilities.resources = capabilities.resources || {
          subscribe: false,
          listChanged: false,
        };
      }
    }

    return capabilities;
  }

  /**
   * Update server capabilities
   */
  updateCapabilities(capabilities: Partial<ServerCapabilities>): void {
    this._capabilities = {
      ...this._capabilities,
      ...capabilities,
    };
  }

  /**
   * Check if a specific capability is enabled
   */
  hasCapability(capability: keyof ServerCapabilities): boolean {
    const capabilities = this.getServerCapabilities();
    return capability in capabilities && capabilities[capability] !== undefined;
  }

  /**
   * Enable prompts capability
   */
  enablePrompts(): void {
    this.updateCapabilities({
      prompts: {},
    });
  }

  /**
   * Enable tools capability
   */
  enableTools(): void {
    this.updateCapabilities({
      tools: {},
    });
  }

  /**
   * Enable resources capability with optional subscription support
   */
  enableResources(options: { subscribe?: boolean; listChanged?: boolean } = {}): void {
    this.updateCapabilities({
      resources: {
        subscribe: options.subscribe || false,
        listChanged: options.listChanged || false,
      },
    });
  }

  /**
   * Enable completion capability
   */
  enableCompletion(): void {
    this.updateCapabilities({
      completion: {},
    });
  }

  /**
   * Enable logging capability
   */
  enableLogging(): void {
    this.updateCapabilities({
      logging: {},
    });
  }

  /**
   * Disable a capability
   */
  disableCapability(capability: keyof ServerCapabilities): void {
    const capabilities = { ...this._capabilities };
    delete capabilities[capability];
    this._capabilities = capabilities;
  }

  /**
   * Get capability summary for debugging
   */
  getCapabilitySummary(): {
    static: string[];
    dynamic: string[];
    total: number;
  } {
    const staticCapabilities = Object.keys(this._capabilities);
    const dynamicCapabilities: string[] = [];

    if (this._primitiveRegistry) {
      if (this._primitiveRegistry.hasPrompts() && !staticCapabilities.includes('prompts')) {
        dynamicCapabilities.push('prompts');
      }
      if (this._primitiveRegistry.hasTools() && !staticCapabilities.includes('tools')) {
        dynamicCapabilities.push('tools');
      }
      if (this._primitiveRegistry.hasResources() && !staticCapabilities.includes('resources')) {
        dynamicCapabilities.push('resources');
      }
    }

    return {
      static: staticCapabilities,
      dynamic: dynamicCapabilities,
      total: staticCapabilities.length + dynamicCapabilities.length,
    };
  }
}

/**
 * Mock primitive registry for testing and standalone usage
 */
export class MockPrimitiveRegistry implements PrimitiveRegistry {
  private _promptCount = 0;
  private _toolCount = 0;
  private _resourceCount = 0;

  setPromptCount(count: number): void {
    this._promptCount = count;
  }

  setToolCount(count: number): void {
    this._toolCount = count;
  }

  setResourceCount(count: number): void {
    this._resourceCount = count;
  }

  getPromptCount(): number {
    return this._promptCount;
  }

  getToolCount(): number {
    return this._toolCount;
  }

  getResourceCount(): number {
    return this._resourceCount;
  }

  hasPrompts(): boolean {
    return this._promptCount > 0;
  }

  hasTools(): boolean {
    return this._toolCount > 0;
  }

  hasResources(): boolean {
    return this._resourceCount > 0;
  }
}
