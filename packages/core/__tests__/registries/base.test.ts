import type { Registry, RegistryCollection } from '../../src/registries/base';
import { DefaultRegistryCollection, REGISTRY_KINDS } from '../../src/registries/base';

describe('Registry Interface', () => {
  it('should define the required interface structure', () => {
    const mockRegistry: Registry = {
      kind: REGISTRY_KINDS.PROMPTS,
      getCapabilities: () => ({}),
      getMetadata: () => ({
        name: 'Test Registry',
      }),
      getStats: () => ({
        totalRegistered: 0,
        successfulOperations: 0,
        failedOperations: 0,
      }),
      isEmpty: () => true,
      size: () => 0,
      clear: () => {
        // empty
      },
    };

    expect(mockRegistry.kind).toBe('prompts');
    expect(typeof mockRegistry.getCapabilities).toBe('function');
    expect(mockRegistry.getCapabilities()).toEqual({});
    expect(mockRegistry.getMetadata().name).toBe('Test Registry');
    expect(mockRegistry.getStats().totalRegistered).toBe(0);
    expect(mockRegistry.isEmpty()).toBe(true);
    expect(mockRegistry.size()).toBe(0);
  });

  it('should export registry kind constants', () => {
    expect(REGISTRY_KINDS.PROMPTS).toBe('prompts');
    expect(REGISTRY_KINDS.TOOLS).toBe('tools');
    expect(REGISTRY_KINDS.RESOURCES).toBe('resources');
  });
});

describe('DefaultRegistryCollection', () => {
  let collection: RegistryCollection;

  beforeEach(() => {
    collection = new DefaultRegistryCollection();
  });

  it('should register and retrieve registries', () => {
    const mockRegistry: Registry = {
      kind: REGISTRY_KINDS.PROMPTS,
      getCapabilities: () => ({ prompts: {} }),
      getMetadata: () => ({ name: 'Test' }),
      getStats: () => ({ totalRegistered: 1, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => false,
      size: () => 1,
      clear: () => {
        // empty
      },
    };

    collection.register(mockRegistry);
    expect(collection.get(REGISTRY_KINDS.PROMPTS)).toBe(mockRegistry);
    expect(collection.getAll()).toHaveLength(1);
  });

  it('should throw error for duplicate registration', () => {
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

    collection.register(mockRegistry);
    expect(() => collection.register(mockRegistry)).toThrow("Registry of kind 'prompts' is already registered");
  });

  it('should combine capabilities from all registries', () => {
    const promptRegistry: Registry = {
      kind: REGISTRY_KINDS.PROMPTS,
      getCapabilities: () => ({ prompts: {} }),
      getMetadata: () => ({ name: 'Prompts' }),
      getStats: () => ({ totalRegistered: 1, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => false,
      size: () => 1,
      clear: () => {
        // empty
      },
    };

    const toolRegistry: Registry = {
      kind: REGISTRY_KINDS.TOOLS,
      getCapabilities: () => ({ tools: {} }),
      getMetadata: () => ({ name: 'Tools' }),
      getStats: () => ({ totalRegistered: 1, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => false,
      size: () => 1,
      clear: () => {
        // empty
      },
    };

    collection.register(promptRegistry);
    collection.register(toolRegistry);

    const combined = collection.getCombinedCapabilities();
    expect(combined).toMatchObject({
      experimental: {},
      logging: {},
      prompts: {},
      tools: {},
    });
  });

  it('should detect if any registry has registrations', () => {
    const emptyRegistry: Registry = {
      kind: REGISTRY_KINDS.PROMPTS,
      getCapabilities: () => ({}),
      getMetadata: () => ({ name: 'Empty' }),
      getStats: () => ({ totalRegistered: 0, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => true,
      size: () => 0,
      clear: () => {
        // empty
      },
    };

    const nonEmptyRegistry: Registry = {
      kind: REGISTRY_KINDS.TOOLS,
      getCapabilities: () => ({ tools: {} }),
      getMetadata: () => ({ name: 'NonEmpty' }),
      getStats: () => ({ totalRegistered: 1, successfulOperations: 0, failedOperations: 0 }),
      isEmpty: () => false,
      size: () => 1,
      clear: () => {
        // empty
      },
    };

    collection.register(emptyRegistry);
    expect(collection.hasAnyRegistrations()).toBe(false);

    collection.register(nonEmptyRegistry);
    expect(collection.hasAnyRegistrations()).toBe(true);
  });
});
