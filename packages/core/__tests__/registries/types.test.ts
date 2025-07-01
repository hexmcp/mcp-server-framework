import { z } from 'zod';
import type {
  HandlerContext,
  PromptArgument,
  PromptDefinition,
  RegistryConfig,
  ResourceContent,
  ResourceDefinition,
  ResourceMetadata,
  ResourceProvider,
  ToolDefinition,
  ToolParameter,
  ValidationResult,
} from '../../src/registries/types';

describe('Enhanced Type Definitions', () => {
  describe('HandlerContext', () => {
    it('should support enhanced context with execution and user info', () => {
      const context: HandlerContext = {
        request: { method: 'test', id: 'test', jsonrpc: '2.0' },
        send: async () => {
          // No-op for testing
        },
        transport: { name: 'test' },
        state: {},
        registry: {
          kind: 'prompts',
          metadata: { test: 'data' },
        },
        execution: {
          executionId: 'test-123',
          startTime: new Date(),
          timeout: 5000,
          metadata: { test: 'execution' },
        },
        user: {
          id: 'user-123',
          roles: ['admin'],
          permissions: ['read', 'write'],
          metadata: { department: 'engineering' },
        },
      };

      expect(context.registry?.kind).toBe('prompts');
      expect(context.execution?.executionId).toBe('test-123');
      expect(context.user?.roles).toContain('admin');
    });
  });

  describe('ValidationResult', () => {
    it('should support success and error states', () => {
      const successResult: ValidationResult = {
        success: true,
        data: { validated: 'data' },
      };

      const errorResult: ValidationResult = {
        success: false,
        errors: [
          { path: ['name'], message: 'Name is required' },
          { path: ['age'], message: 'Age must be a number', code: 'INVALID_TYPE' },
        ],
      };

      expect(successResult.success).toBe(true);
      expect(successResult.data).toEqual({ validated: 'data' });
      expect(errorResult.success).toBe(false);
      expect(errorResult.errors).toHaveLength(2);
    });
  });

  describe('Enhanced PromptDefinition', () => {
    it('should support all enhanced features', () => {
      const promptArgs: PromptArgument[] = [
        {
          name: 'query',
          description: 'Search query',
          required: true,
          schema: z.string().min(1),
        },
        {
          name: 'limit',
          description: 'Result limit',
          required: false,
          schema: z.number().max(100),
        },
      ];

      const definition: PromptDefinition = {
        name: 'search-prompt',
        description: 'Search for information',
        arguments: promptArgs,
        tags: ['search', 'utility'],
        version: '2.0.0',
        streaming: true,
        cache: {
          enabled: true,
          ttl: 300,
          key: (args) => `search:${args.query}:${args.limit || 10}`,
        },
        rateLimit: {
          maxCalls: 100,
          windowMs: 60000,
          keyGenerator: (context) => context.user?.id || 'anonymous',
        },
        handler: async (args, _context) => {
          return `Search results for: ${args.query}`;
        },
        validate: (args) => {
          if (!args.query || typeof args.query !== 'string') {
            return {
              success: false,
              errors: [{ path: ['query'], message: 'Query is required' }],
            };
          }
          return { success: true };
        },
        hooks: {
          beforeExecution: async (args, _context) => {
            console.log(`Executing search: ${args.query}`);
          },
          afterExecution: async (_result, _context) => {
            console.log('Search completed');
          },
          onError: async (error, _context) => {
            console.error('Search failed:', error);
          },
        },
      };

      expect(definition.name).toBe('search-prompt');
      expect(definition.arguments).toHaveLength(2);
      expect(definition.streaming).toBe(true);
      expect(definition.cache?.enabled).toBe(true);
      expect(definition.rateLimit?.maxCalls).toBe(100);
      expect(definition.hooks?.beforeExecution).toBeDefined();
    });
  });

  describe('Enhanced ToolDefinition', () => {
    it('should support all enhanced features', () => {
      const toolParams: ToolParameter[] = [
        {
          name: 'action',
          type: 'string',
          description: 'Action to perform',
          required: true,
          enum: ['create', 'update', 'delete'],
          schema: z.enum(['create', 'update', 'delete']),
        },
        {
          name: 'data',
          type: 'object',
          description: 'Data payload',
          required: false,
          schema: z.object({ id: z.string() }),
        },
      ];

      const definition: ToolDefinition = {
        name: 'data-tool',
        description: 'Manage data operations',
        parameters: toolParams,
        scopes: ['data:read', 'data:write'],
        tags: ['data', 'management'],
        version: '1.5.0',
        dangerous: true,
        rateLimit: {
          maxCalls: 50,
          windowMs: 60000,
        },
        cache: {
          enabled: false,
        },
        handler: async (args, _context) => {
          return {
            content: { action: args.action, result: 'success' },
            isError: false,
            metadata: { executionTime: 150 },
          };
        },
        validate: (_args) => ({ success: true }),
        hooks: {
          beforeExecution: async (args, context) => {
            if (args.action === 'delete' && !context.user?.permissions?.includes('delete')) {
              throw new Error('Insufficient permissions for delete operation');
            }
          },
        },
      };

      expect(definition.name).toBe('data-tool');
      expect(definition.parameters).toHaveLength(2);
      expect(definition.dangerous).toBe(true);
      expect(definition.scopes).toContain('data:write');
    });
  });

  describe('Enhanced ResourceDefinition', () => {
    it('should support all enhanced features', () => {
      const provider: ResourceProvider = {
        get: async (uri, _context) => {
          const metadata: ResourceMetadata = {
            uri,
            name: 'Test Resource',
            mimeType: 'application/json',
            size: 1024,
            lastModified: new Date(),
            tags: ['test'],
          };

          const content: ResourceContent = {
            data: { test: 'data' },
            metadata,
            encoding: 'utf-8',
            cached: false,
          };

          return content;
        },
        list: async (_cursor, _context) => ({
          resources: [
            {
              uri: 'test://resource1',
              name: 'Resource 1',
              mimeType: 'application/json',
            },
          ],
          hasMore: false,
        }),
        exists: async (_uri, _context) => true,
        getMetadata: async (uri, _context) => ({
          uri,
          name: 'Test Resource',
          mimeType: 'application/json',
        }),
        search: async (_query, _context) => ({
          resources: [],
          hasMore: false,
        }),
      };

      const definition: ResourceDefinition = {
        uriPattern: 'test://',
        name: 'Test Resources',
        description: 'Test resource provider',
        mimeType: 'application/json',
        tags: ['test', 'demo'],
        version: '1.0.0',
        watchable: true,
        searchable: true,
        cache: {
          enabled: true,
          ttl: 600,
          key: (uri) => `resource:${uri}`,
        },
        rateLimit: {
          maxCalls: 200,
          windowMs: 60000,
        },
        provider,
        validateUri: (uri) => {
          if (!uri.startsWith('test://')) {
            return {
              success: false,
              errors: [{ path: ['uri'], message: 'URI must start with test://' }],
            };
          }
          return { success: true };
        },
        hooks: {
          beforeGet: async (uri, _context) => {
            console.log(`Fetching resource: ${uri}`);
          },
        },
      };

      expect(definition.uriPattern).toBe('test://');
      expect(definition.watchable).toBe(true);
      expect(definition.searchable).toBe(true);
      expect(definition.provider).toBeDefined();
    });
  });

  describe('RegistryConfig', () => {
    it('should support comprehensive configuration', () => {
      const config: RegistryConfig = {
        schemas: {
          promptArgs: z.object({ query: z.string() }),
          toolParams: z.object({ action: z.string() }),
          resourceUri: z.string().url(),
          custom: {
            userInput: z.object({ name: z.string(), email: z.string().email() }),
          },
        },
        cache: {
          enabled: true,
          defaultTtl: 300,
          maxSize: 1000,
        },
        rateLimit: {
          enabled: true,
          defaultMaxCalls: 100,
          defaultWindowMs: 60000,
        },
        metrics: {
          enabled: true,
          detailed: true,
          retention: 86400,
        },
        security: {
          requireAuth: true,
          allowedScopes: ['read', 'write', 'admin'],
          dangerousToolsRequireConfirmation: true,
        },
      };

      expect(config.cache?.enabled).toBe(true);
      expect(config.rateLimit?.defaultMaxCalls).toBe(100);
      expect(config.security?.requireAuth).toBe(true);
      expect(config.schemas?.custom?.userInput).toBeDefined();
    });
  });
});
