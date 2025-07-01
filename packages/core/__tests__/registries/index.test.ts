import {
  type HandlerContext,
  InMemoryResourceProvider,
  type PromptDefinition,
  PromptRegistry,
  REGISTRY_KINDS,
  type Registry,
  type ResourceDefinition,
  type ResourceProvider,
  ResourceRegistry,
  type ToolDefinition,
  ToolRegistry,
} from '../../src/registries/index';

describe('Registries Module Exports', () => {
  it('should export all required types and classes', () => {
    expect(PromptRegistry).toBeDefined();
    expect(ToolRegistry).toBeDefined();
    expect(ResourceRegistry).toBeDefined();
    expect(InMemoryResourceProvider).toBeDefined();

    const mockRegistry: Registry = {
      kind: REGISTRY_KINDS.PROMPTS,
      getCapabilities: () => ({}),
      getMetadata: () => ({ name: 'Test' }),
      getStats: () => ({ totalRegistered: 0, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => true,
      size: () => 0,
      clear: () => {
        // empty
      },
    };

    const mockContext: HandlerContext = {
      request: { method: 'test', id: 'test' } as any,
      send: async () => {
        return;
      },
      transport: { name: 'test' },
      state: {},
    };

    const mockPromptDef: PromptDefinition = {
      name: 'test',
      handler: async () => 'test',
    };

    const mockToolDef: ToolDefinition = {
      name: 'test',
      handler: async () => ({ result: 'test' }),
    };

    const mockResourceProvider: ResourceProvider = {
      get: async () => ({ data: 'test' }),
      list: async () => ({ resources: [] }),
    };

    const mockResourceDef: ResourceDefinition = {
      uriPattern: 'test://',
      provider: mockResourceProvider,
    };

    expect(mockRegistry).toBeDefined();
    expect(mockContext).toBeDefined();
    expect(mockPromptDef).toBeDefined();
    expect(mockToolDef).toBeDefined();
    expect(mockResourceDef).toBeDefined();
    expect(mockResourceProvider).toBeDefined();
  });

  it('should create working instances of all registry classes', () => {
    const promptRegistry = new PromptRegistry();
    const toolRegistry = new ToolRegistry();
    const resourceRegistry = new ResourceRegistry();
    const inMemoryProvider = new InMemoryResourceProvider();

    expect(promptRegistry.kind).toBe('prompts');
    expect(toolRegistry.kind).toBe('tools');
    expect(resourceRegistry.kind).toBe('resources');
    expect(inMemoryProvider).toBeInstanceOf(InMemoryResourceProvider);
  });
});
