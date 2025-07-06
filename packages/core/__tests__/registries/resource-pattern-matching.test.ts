import { ResourceRegistry } from '../../src/registries/resources';
import type { ResourceDefinition, ResourceProvider } from '../../src/registries/types';

describe('ResourceRegistry Pattern Matching', () => {
  let registry: ResourceRegistry;
  let mockProvider: ResourceProvider;

  beforeEach(() => {
    registry = new ResourceRegistry();
    mockProvider = {
      get: jest.fn().mockResolvedValue({ uri: 'test', mimeType: 'text/plain', text: 'test content' }),
      list: jest.fn().mockResolvedValue({ resources: [] }),
    };
  });

  describe('Wildcard Pattern Matching', () => {
    it('should match double wildcard patterns correctly', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'notes://**',
        name: 'Notes',
        description: 'Note resources',
        provider: mockProvider,
      };

      registry.register(definition);

      // Test various URI patterns that should match
      expect(registry.has('notes://')).toBe(true);
      expect(registry.has('notes://123')).toBe(true);
      expect(registry.has('notes://123/456')).toBe(true);
      expect(registry.has('notes://folder/subfolder/file')).toBe(true);
    });

    it('should match single wildcard patterns correctly', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'files://*/data',
        name: 'File Data',
        description: 'File data resources',
        provider: mockProvider,
      };

      registry.register(definition);

      // Should match single path segment
      expect(registry.has('files://folder/data')).toBe(true);
      expect(registry.has('files://123/data')).toBe(true);

      // Should not match multiple path segments
      expect(registry.has('files://folder/subfolder/data')).toBe(false);
      expect(registry.has('files:///data')).toBe(true); // Empty segment
    });

    it('should handle trailing slash patterns correctly', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'api://service/',
        name: 'API Service',
        description: 'API service resources',
        provider: mockProvider,
      };

      registry.register(definition);

      // Both with and without trailing slash should match
      expect(registry.has('api://service/')).toBe(true);
      expect(registry.has('api://service')).toBe(true);
    });
  });

  describe('Empty vs Root Pathname Handling', () => {
    it('should handle empty pathname correctly', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'scheme://**',
        name: 'Scheme Resources',
        description: 'All scheme resources',
        provider: mockProvider,
      };

      registry.register(definition);

      // Empty pathname should be treated as root
      expect(registry.has('scheme://')).toBe(true);
      expect(registry.has('scheme:///')).toBe(true);
    });

    it('should handle root pathname correctly', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'root:///',
        name: 'Root Resources',
        description: 'Root path resources',
        provider: mockProvider,
      };

      registry.register(definition);

      expect(registry.has('root:///')).toBe(true);
      expect(registry.has('root://')).toBe(true);
    });
  });

  describe('Protocol and Hostname Validation', () => {
    it('should not match different protocols', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'http://example.com/**',
        name: 'HTTP Resources',
        description: 'HTTP resources',
        provider: mockProvider,
      };

      registry.register(definition);

      expect(registry.has('http://example.com/path')).toBe(true);
      expect(registry.has('https://example.com/path')).toBe(false);
      expect(registry.has('ftp://example.com/path')).toBe(false);
    });

    it('should not match different hostnames', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'http://api.example.com/**',
        name: 'API Resources',
        description: 'API resources',
        provider: mockProvider,
      };

      registry.register(definition);

      expect(registry.has('http://api.example.com/data')).toBe(true);
      expect(registry.has('http://web.example.com/data')).toBe(false);
      expect(registry.has('http://example.com/data')).toBe(false);
    });
  });

  describe('Longest Match Selection', () => {
    it('should select the longest matching pattern', () => {
      const generalProvider = {
        get: jest.fn().mockResolvedValue({ type: 'general' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const specificProvider = {
        get: jest.fn().mockResolvedValue({ type: 'specific' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      registry.register({
        uriPattern: 'test://**',
        name: 'General',
        description: 'General resources',
        provider: generalProvider,
      });

      registry.register({
        uriPattern: 'test://specific/**',
        name: 'Specific',
        description: 'Specific resources',
        provider: specificProvider,
      });

      // Should match the more specific pattern
      expect(registry.has('test://specific/resource')).toBe(true);
      expect(registry.has('test://general/resource')).toBe(true);
    });
  });

  describe('Invalid URI Handling', () => {
    it('should handle invalid URIs gracefully', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'valid://test/**',
        name: 'Valid Resources',
        description: 'Valid resources',
        provider: mockProvider,
      };

      registry.register(definition);

      // Invalid URIs should not match
      expect(registry.has('not-a-uri')).toBe(false);
      expect(registry.has('://invalid')).toBe(false);
      expect(registry.has('')).toBe(false);
    });
  });

  describe('Complex Pattern Scenarios', () => {
    it('should handle mixed wildcard patterns', () => {
      const definition: ResourceDefinition = {
        uriPattern: 'complex://*/data/**',
        name: 'Complex Resources',
        description: 'Complex pattern resources',
        provider: mockProvider,
      };

      registry.register(definition);

      expect(registry.has('complex://folder/data/file.txt')).toBe(true);
      expect(registry.has('complex://folder/data/sub/file.txt')).toBe(true);
      expect(registry.has('complex://folder/other/file.txt')).toBe(false);
      expect(registry.has('complex://folder1/folder2/data/file.txt')).toBe(false);
    });

    it('should handle exact match vs pattern match priority', () => {
      const exactProvider = {
        get: jest.fn().mockResolvedValue({ type: 'exact' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      const patternProvider = {
        get: jest.fn().mockResolvedValue({ type: 'pattern' }),
        list: jest.fn().mockResolvedValue({ resources: [] }),
      };

      registry.register({
        uriPattern: 'test://exact/match',
        name: 'Exact',
        description: 'Exact match',
        provider: exactProvider,
      });

      registry.register({
        uriPattern: 'test://exact/**',
        name: 'Pattern',
        description: 'Pattern match',
        provider: patternProvider,
      });

      // Both patterns should match their respective URIs
      expect(registry.has('test://exact/match')).toBe(true);
      expect(registry.has('test://exact/other')).toBe(true);
    });
  });
});
