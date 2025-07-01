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
    // Add many resources to test pagination
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
});
