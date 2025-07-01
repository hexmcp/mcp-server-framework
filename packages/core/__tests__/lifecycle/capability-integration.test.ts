import { McpCapabilityRegistry, MockPrimitiveRegistry, RegistryPrimitiveRegistry } from '../../src/lifecycle/capability-registry';
import { PromptRegistry } from '../../src/registries/prompts';
import { ResourceRegistry } from '../../src/registries/resources';
import { ToolRegistry } from '../../src/registries/tools';
import type { PromptDefinition, ResourceDefinition, ResourceProvider, ToolDefinition } from '../../src/registries/types';

describe('Capability Integration', () => {
  let capabilityRegistry: McpCapabilityRegistry;
  let promptRegistry: PromptRegistry;
  let toolRegistry: ToolRegistry;
  let resourceRegistry: ResourceRegistry;
  let registryPrimitiveRegistry: RegistryPrimitiveRegistry;

  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    toolRegistry = new ToolRegistry();
    resourceRegistry = new ResourceRegistry();
    registryPrimitiveRegistry = new RegistryPrimitiveRegistry(promptRegistry, toolRegistry, resourceRegistry);
    capabilityRegistry = new McpCapabilityRegistry();
    capabilityRegistry.setPrimitiveRegistry(registryPrimitiveRegistry);
  });

  describe('RegistryPrimitiveRegistry', () => {
    it('should track registry counts correctly', () => {
      expect(registryPrimitiveRegistry.getPromptCount()).toBe(0);
      expect(registryPrimitiveRegistry.getToolCount()).toBe(0);
      expect(registryPrimitiveRegistry.getResourceCount()).toBe(0);

      const promptDef: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'response',
      };

      const toolDef: ToolDefinition = {
        name: 'test-tool',
        handler: async () => ({ result: 'success' }),
      };

      const mockProvider: ResourceProvider = {
        get: async () => ({ content: 'data' }),
        list: async () => ({ resources: [] }),
      };

      const resourceDef: ResourceDefinition = {
        uriPattern: 'test://resource',
        provider: mockProvider,
      };

      promptRegistry.register(promptDef);
      toolRegistry.register(toolDef);
      resourceRegistry.register(resourceDef);

      expect(registryPrimitiveRegistry.getPromptCount()).toBe(1);
      expect(registryPrimitiveRegistry.getToolCount()).toBe(1);
      expect(registryPrimitiveRegistry.getResourceCount()).toBe(1);
      expect(registryPrimitiveRegistry.hasPrompts()).toBe(true);
      expect(registryPrimitiveRegistry.hasTools()).toBe(true);
      expect(registryPrimitiveRegistry.hasResources()).toBe(true);
    });

    it('should combine capabilities from all registries', () => {
      const streamingPrompt: PromptDefinition = {
        name: 'streaming-prompt',
        streaming: true,
        handler: async () => 'response',
      };

      const watchableResource: ResourceDefinition = {
        uriPattern: 'test://watchable',
        watchable: true,
        provider: {
          get: async () => ({ content: 'data' }),
          list: async () => ({ resources: [] }),
        },
      };

      promptRegistry.register(streamingPrompt);
      resourceRegistry.register(watchableResource);

      const capabilities = registryPrimitiveRegistry.getRegistryCapabilities();

      expect(capabilities).toEqual({
        prompts: {
          streaming: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        },
      });
    });

    it('should support dynamic registry updates', () => {
      const newPromptRegistry = new PromptRegistry();
      registryPrimitiveRegistry.setPromptRegistry(newPromptRegistry);

      const promptDef: PromptDefinition = {
        name: 'new-prompt',
        handler: async () => 'response',
      };

      newPromptRegistry.register(promptDef);

      expect(registryPrimitiveRegistry.getPromptCount()).toBe(1);
      expect(registryPrimitiveRegistry.hasPrompts()).toBe(true);
    });
  });

  describe('McpCapabilityRegistry Integration', () => {
    it('should merge static and dynamic capabilities', () => {
      capabilityRegistry.enableCompletion();
      capabilityRegistry.enableLogging();

      const streamingPrompt: PromptDefinition = {
        name: 'streaming-prompt',
        streaming: true,
        handler: async () => 'response',
      };

      promptRegistry.register(streamingPrompt);

      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        completion: {},
        prompts: {
          streaming: true,
        },
      });
    });

    it('should handle complex capability merging', () => {
      capabilityRegistry.enableResources({ subscribe: false, listChanged: false });

      const watchableResource: ResourceDefinition = {
        uriPattern: 'test://watchable',
        watchable: true,
        provider: {
          get: async () => ({ content: 'data' }),
          list: async () => ({ resources: [] }),
        },
      };

      resourceRegistry.register(watchableResource);

      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities.resources).toEqual({
        subscribe: true,
        listChanged: true,
      });
    });

    it('should fall back to mock registry behavior', () => {
      const mockRegistry = new MockPrimitiveRegistry();
      mockRegistry.setPromptCount(2);
      mockRegistry.setToolCount(1);

      capabilityRegistry.setPrimitiveRegistry(mockRegistry);

      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        prompts: {},
        tools: {},
      });
    });

    it('should handle empty registries gracefully', () => {
      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities).toEqual({
        experimental: {},
        logging: {},
      });
    });

    it('should support experimental capabilities', () => {
      capabilityRegistry.addExperimentalCapability('custom-feature', { enabled: true });

      const streamingPrompt: PromptDefinition = {
        name: 'streaming-prompt',
        streaming: true,
        handler: async () => 'response',
      };

      promptRegistry.register(streamingPrompt);

      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities.experimental).toEqual({
        'custom-feature': { enabled: true },
      });
      expect(capabilities.prompts).toEqual({
        streaming: true,
      });
    });

    it('should provide capability summary', () => {
      capabilityRegistry.enableCompletion();
      capabilityRegistry.addExperimentalCapability('test-feature');

      const promptDef: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'response',
      };

      promptRegistry.register(promptDef);

      const summary = capabilityRegistry.getCapabilitySummary();

      expect(summary.static).toContain('completion');
      expect(summary.static).toContain('experimental');
      expect(summary.dynamic).toContain('prompts');
      expect(summary.total).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle registry with no registrations', () => {
      const capabilities = registryPrimitiveRegistry.getRegistryCapabilities();
      expect(capabilities).toEqual({});
    });

    it('should handle partial registry setup', () => {
      const partialRegistry = new RegistryPrimitiveRegistry(promptRegistry);

      const promptDef: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'response',
      };

      promptRegistry.register(promptDef);

      expect(partialRegistry.getPromptCount()).toBe(1);
      expect(partialRegistry.getToolCount()).toBe(0);
      expect(partialRegistry.getResourceCount()).toBe(0);
      expect(partialRegistry.hasPrompts()).toBe(true);
      expect(partialRegistry.hasTools()).toBe(false);
      expect(partialRegistry.hasResources()).toBe(false);
    });

    it('should handle capability updates after registration', () => {
      const capabilities1 = capabilityRegistry.getServerCapabilities();
      expect(capabilities1.prompts).toBeUndefined();

      const promptDef: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'response',
      };

      promptRegistry.register(promptDef);

      const capabilities2 = capabilityRegistry.getServerCapabilities();
      expect(capabilities2.prompts).toEqual({});
    });
  });
});
