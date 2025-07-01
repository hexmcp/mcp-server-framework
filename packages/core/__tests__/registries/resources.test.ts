import { InMemoryResourceProvider, ResourceRegistry } from '../../src/registries/resources';
import type { HandlerContext, ResourceDefinition, ResourceProvider } from '../../src/registries/types';

describe('InMemoryResourceProvider', () => {
  let provider: InMemoryResourceProvider;
  const mockContext: HandlerContext = {
    request: { method: 'resources/read', id: 'test' } as any,
    send: async () => {
      return;
    },
    transport: { name: 'test' },
    state: {},
  };

  beforeEach(() => {
    provider = new InMemoryResourceProvider();
  });

  it('should add and retrieve resources', async () => {
    const content = { data: 'test content' };
    provider.addResource('test://resource1', content, {
      name: 'Test Resource',
      description: 'A test resource',
      mimeType: 'application/json',
    });

    const result = await provider.get('test://resource1', mockContext);
    expect(result).toEqual(content);
  });

  it('should throw error for missing resource', async () => {
    await expect(provider.get('test://missing', mockContext)).rejects.toThrow("Resource 'test://missing' not found");
  });

  it('should list resources with metadata', async () => {
    provider.addResource(
      'test://resource1',
      { data: 'content1' },
      {
        name: 'Resource 1',
        mimeType: 'application/json',
      }
    );
    provider.addResource(
      'test://resource2',
      { data: 'content2' },
      {
        name: 'Resource 2',
        description: 'Second resource',
      }
    );

    const result = await provider.list();
    expect(result.resources).toHaveLength(2);
    expect(result.resources).toContainEqual({
      uri: 'test://resource1',
      name: 'Resource 1',
      mimeType: 'application/json',
      description: undefined,
    });
    expect(result.resources).toContainEqual({
      uri: 'test://resource2',
      name: 'Resource 2',
      description: 'Second resource',
      mimeType: undefined,
    });
  });

  it('should support pagination', async () => {
    for (let i = 0; i < 100; i++) {
      provider.addResource(`test://resource${i}`, { data: `content${i}` });
    }

    const firstPage = await provider.list();
    expect(firstPage.resources).toHaveLength(50); // Default page size
    expect(firstPage.nextCursor).toBeDefined();

    const secondPage = await provider.list(firstPage.nextCursor);
    expect(secondPage.resources).toHaveLength(50);
    expect(secondPage.nextCursor).toBeUndefined(); // No more pages
  });

  it('should remove resources', () => {
    provider.addResource('test://resource1', { data: 'content' });
    expect(provider.removeResource('test://resource1')).toBe(true);
    expect(provider.removeResource('test://resource1')).toBe(false); // Already removed
  });
});

describe('ResourceRegistry', () => {
  let registry: ResourceRegistry;

  beforeEach(() => {
    registry = new ResourceRegistry();
  });

  describe('basic functionality', () => {
    it('should have correct kind', () => {
      expect(registry.kind).toBe('resources');
    });

    it('should start empty', () => {
      expect(registry.size()).toBe(0);
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should register a resource definition', () => {
      const provider = new InMemoryResourceProvider();
      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        name: 'Test Resources',
        description: 'Test resource provider',
        provider,
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);
      expect(registry.has('test://resource1')).toBe(true);
    });

    it('should throw error for duplicate pattern registration', () => {
      const provider = new InMemoryResourceProvider();
      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        provider,
      };

      registry.register(definition);
      expect(() => registry.register(definition)).toThrow("Resource pattern 'test://' is already registered");
    });

    it('should clear all resources', () => {
      const provider = new InMemoryResourceProvider();
      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        provider,
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.has('test://resource1')).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('should return empty capabilities when no resources registered', () => {
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should return resources capability when resources are registered', () => {
      const provider = new InMemoryResourceProvider();
      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        provider,
      };

      registry.register(definition);
      expect(registry.getCapabilities()).toEqual({
        resources: {
          subscribe: false,
          listChanged: false,
        },
      });
    });
  });

  describe('resource operations', () => {
    const mockContext: HandlerContext = {
      request: { method: 'resources/read', id: 'test' } as any,
      send: async () => {
        return;
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should get resource from registered provider', async () => {
      const provider = new InMemoryResourceProvider();
      provider.addResource('test://resource1', { data: 'test content' });

      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        provider,
      };

      registry.register(definition);
      const result = await registry.get('test://resource1', mockContext);
      expect(result).toEqual({ data: 'test content' });
    });

    it('should throw error for resource without provider', async () => {
      await expect(registry.get('unknown://resource', mockContext)).rejects.toThrow("No provider found for resource 'unknown://resource'");
    });

    it('should find provider by longest matching pattern', async () => {
      const generalProvider = new InMemoryResourceProvider();
      generalProvider.addResource('test://general/resource', { type: 'general' });

      const specificProvider = new InMemoryResourceProvider();
      specificProvider.addResource('test://specific/resource', { type: 'specific' });

      registry.register({ uriPattern: 'test://', provider: generalProvider });
      registry.register({ uriPattern: 'test://specific/', provider: specificProvider });

      const specificResult = await registry.get('test://specific/resource', mockContext);
      expect(specificResult).toEqual({ type: 'specific' });

      const generalResult = await registry.get('test://general/resource', mockContext);
      expect(generalResult).toEqual({ type: 'general' });
    });

    it('should list resources from all providers', async () => {
      const provider1 = new InMemoryResourceProvider();
      provider1.addResource('test1://resource1', { data: 'content1' });

      const provider2 = new InMemoryResourceProvider();
      provider2.addResource('test2://resource2', { data: 'content2' });

      registry.register({ uriPattern: 'test1://', provider: provider1 });
      registry.register({ uriPattern: 'test2://', provider: provider2 });

      const result = await registry.list();
      expect(result.resources).toHaveLength(2);
      expect(result.resources.map((r) => r.uri)).toContain('test1://resource1');
      expect(result.resources.map((r) => r.uri)).toContain('test2://resource2');
    });

    it('should handle provider errors gracefully during listing', async () => {
      const workingProvider = new InMemoryResourceProvider();
      workingProvider.addResource('working://resource', { data: 'content' });

      const failingProvider: ResourceProvider = {
        get: async () => {
          throw new Error('Provider error');
        },
        list: async () => {
          throw new Error('Provider error');
        },
      };

      registry.register({ uriPattern: 'working://', provider: workingProvider });
      registry.register({ uriPattern: 'failing://', provider: failingProvider });

      const result = await registry.list();
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0]?.uri).toBe('working://resource');
    });
  });

  describe('enhanced features', () => {
    const mockContext: HandlerContext = {
      request: { method: 'resources/read', id: 'test' } as any,
      send: async () => {
        // No-op for testing
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should execute lifecycle hooks', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();

      const mockProvider: ResourceProvider = {
        get: jest.fn().mockResolvedValue({ content: 'test data' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const definition: ResourceDefinition = {
        uriPattern: 'test://hooks',
        provider: mockProvider,
        hooks: {
          beforeGet: beforeHook,
          afterGet: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      const result = await registry.get('test://hooks/resource', mockContext);

      expect(beforeHook).toHaveBeenCalledWith('test://hooks/resource', expect.any(Object));
      expect(afterHook).toHaveBeenCalledWith({ content: 'test data' }, expect.any(Object));
      expect(errorHook).not.toHaveBeenCalled();
      expect(result).toEqual({ content: 'test data' });
    });

    it('should execute error hook on failure', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();
      const error = new Error('Provider failed');

      const mockProvider: ResourceProvider = {
        get: jest.fn().mockRejectedValue(error),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const definition: ResourceDefinition = {
        uriPattern: 'test://error',
        provider: mockProvider,
        hooks: {
          beforeGet: beforeHook,
          afterGet: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      await expect(registry.get('test://error/resource', mockContext)).rejects.toThrow('Provider failed');

      expect(beforeHook).toHaveBeenCalled();
      expect(afterHook).not.toHaveBeenCalled();
      expect(errorHook).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should include enhanced metadata in context', async () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn().mockResolvedValue({ content: 'test data' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const definition: ResourceDefinition = {
        uriPattern: 'test://metadata',
        name: 'Metadata Resource',
        description: 'A resource with metadata',
        version: '2.0.0',
        tags: ['test', 'demo'],
        mimeType: 'application/json',
        watchable: true,
        cache: { enabled: true, ttl: 300 },
        rateLimit: { maxCalls: 100, windowMs: 60000 },
        provider: mockProvider,
      };

      registry.register(definition);
      await registry.get('test://metadata/resource', mockContext);

      expect(mockProvider.get).toHaveBeenCalledWith(
        'test://metadata/resource',
        expect.objectContaining({
          registry: expect.objectContaining({
            kind: 'resources',
            metadata: expect.objectContaining({
              resourceUri: 'test://metadata/resource',
              uriPattern: 'test://metadata',
              name: 'Metadata Resource',
              description: 'A resource with metadata',
              version: '2.0.0',
              tags: ['test', 'demo'],
              mimeType: 'application/json',
              cache: { enabled: true, ttl: 300 },
              rateLimit: { maxCalls: 100, windowMs: 60000 },
            }),
          }),
          execution: expect.objectContaining({
            executionId: expect.stringMatching(/^resource-test:\/\/metadata\/resource-\d+-[a-z0-9]+$/),
            startTime: expect.any(Date),
            metadata: {
              resourceUri: 'test://metadata/resource',
              uriPattern: 'test://metadata',
            },
          }),
        })
      );
    });
  });

  describe('enhanced registry methods', () => {
    beforeEach(() => {
      registry.clear();
    });

    it('should get resources by tags', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const resource1: ResourceDefinition = {
        uriPattern: 'test://resource1',
        tags: ['tag1', 'tag2'],
        provider: mockProvider,
      };

      const resource2: ResourceDefinition = {
        uriPattern: 'test://resource2',
        tags: ['tag2', 'tag3'],
        provider: mockProvider,
      };

      registry.register(resource1);
      registry.register(resource2);

      const results = registry.getByTags(['tag2']);
      expect(results).toHaveLength(2);
      expect(results).toContain('test://resource1');
      expect(results).toContain('test://resource2');

      const specificResults = registry.getByTags(['tag1']);
      expect(specificResults).toHaveLength(1);
      expect(specificResults).toContain('test://resource1');
    });

    it('should get resources by MIME type', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const jsonResource: ResourceDefinition = {
        uriPattern: 'test://json',
        mimeType: 'application/json',
        provider: mockProvider,
      };

      const textResource: ResourceDefinition = {
        uriPattern: 'test://text',
        mimeType: 'text/plain',
        provider: mockProvider,
      };

      registry.register(jsonResource);
      registry.register(textResource);

      const jsonResults = registry.getByMimeType('application/json');
      expect(jsonResults).toHaveLength(1);
      expect(jsonResults).toContain('test://json');

      const textResults = registry.getByMimeType('text/plain');
      expect(textResults).toHaveLength(1);
      expect(textResults).toContain('test://text');
    });

    it('should get watchable and searchable resources', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const watchableResource: ResourceDefinition = {
        uriPattern: 'test://watchable',
        watchable: true,
        provider: mockProvider,
      };

      const searchableResource: ResourceDefinition = {
        uriPattern: 'test://searchable',
        searchable: true,
        provider: mockProvider,
      };

      registry.register(watchableResource);
      registry.register(searchableResource);

      const watchableResults = registry.getWatchableResources();
      expect(watchableResults).toHaveLength(1);
      expect(watchableResults).toContain('test://watchable');

      const searchableResults = registry.getSearchableResources();
      expect(searchableResults).toHaveLength(1);
      expect(searchableResults).toContain('test://searchable');
    });

    it('should validate resource definitions', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const validDefinition: ResourceDefinition = {
        uriPattern: 'test://valid',
        name: 'Valid Resource',
        version: '1.0.0',
        mimeType: 'application/json',
        provider: mockProvider,
      };

      const validResult = registry.validateDefinition(validDefinition);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidDefinition = {
        provider: mockProvider,
      } as unknown as ResourceDefinition;

      const invalidResult = registry.validateDefinition(invalidDefinition);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Resource URI pattern is required and must be a string');

      const badMimeDefinition: ResourceDefinition = {
        uriPattern: 'test://bad-mime',
        mimeType: 'invalid-mime-type',
        provider: mockProvider,
      };

      const badMimeResult = registry.validateDefinition(badMimeDefinition);
      expect(badMimeResult.valid).toBe(false);
      expect(badMimeResult.errors).toContain('MIME type must be in valid format (e.g., text/plain, application/json)');
    });

    it('should get detailed capabilities', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const watchableResource: ResourceDefinition = {
        uriPattern: 'test://watchable',
        watchable: true,
        provider: mockProvider,
      };

      const validatedResource: ResourceDefinition = {
        uriPattern: 'test://validated',
        validateUri: () => ({ success: true }),
        searchable: true,
        hooks: {
          beforeGet: async () => {
            // No-op for testing
          },
        },
        provider: mockProvider,
      };

      registry.register(watchableResource);
      registry.register(validatedResource);

      const capabilities = registry.getDetailedCapabilities();
      expect(capabilities.totalResources).toBe(2);
      expect(capabilities.watchableResources).toBe(1);
      expect(capabilities.searchableResources).toBe(1);
      expect(capabilities.resourcesWithValidation).toBe(1);
      expect(capabilities.resourcesWithHooks).toBe(1);
      expect(capabilities.capabilities.resources?.subscribe).toBe(true);
    });

    it('should provide enhanced statistics', () => {
      const mockProvider: ResourceProvider = {
        get: jest.fn(),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const complexResource: ResourceDefinition = {
        uriPattern: 'test://complex',
        name: 'Complex Resource',
        description: 'A complex resource',
        version: '2.0.0',
        tags: ['complex', 'test'],
        mimeType: 'application/json',
        watchable: true,
        searchable: true,
        validateUri: () => ({ success: true }),
        cache: { enabled: true, ttl: 300 },
        rateLimit: { maxCalls: 100, windowMs: 60000 },
        hooks: {
          beforeGet: async () => {
            // No-op for testing
          },
          afterGet: async () => {
            // No-op for testing
          },
        },
        provider: mockProvider,
      };

      registry.register(complexResource);

      const stats = registry.getStats();
      expect(stats.totalRegistered).toBe(1);
      expect(stats.customMetrics?.resourcesWithName).toBe(1);
      expect(stats.customMetrics?.resourcesWithDescription).toBe(1);
      expect(stats.customMetrics?.resourcesWithMimeType).toBe(1);
      expect(stats.customMetrics?.resourcesWithTags).toBe(1);
      expect(stats.customMetrics?.resourcesWithVersion).toBe(1);
      expect(stats.customMetrics?.watchableResources).toBe(1);
      expect(stats.customMetrics?.searchableResources).toBe(1);
      expect(stats.customMetrics?.resourcesWithValidation).toBe(1);
      expect(stats.customMetrics?.resourcesWithHooks).toBe(1);
      expect(stats.customMetrics?.resourcesWithCaching).toBe(1);
      expect(stats.customMetrics?.resourcesWithRateLimit).toBe(1);
      expect(stats.customMetrics?.uniqueTags).toBe(2);
      expect(stats.customMetrics?.uniqueMimeTypes).toBe(1);
      expect(stats.customMetrics?.averageTagsPerResource).toBe(2);
    });
  });
});
