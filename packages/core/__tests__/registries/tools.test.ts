import { z } from 'zod';
import { ToolRegistry } from '../../src/registries/tools';
import type { HandlerContext, ToolDefinition, ToolParameter } from '../../src/registries/types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('basic functionality', () => {
    it('should have correct kind', () => {
      expect(registry.kind).toBe('tools');
    });

    it('should start empty', () => {
      expect(registry.size()).toBe(0);
      expect(registry.list()).toEqual([]);
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should register a tool', () => {
      const definition: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);
      expect(registry.has('test-tool')).toBe(true);
      expect(registry.list()).toEqual([
        {
          name: 'test-tool',
          description: 'A test tool',
          scope: undefined,
          throttle: undefined,
          hasSchema: false,
          hasHooks: false,
        },
      ]);
    });

    it('should register a tool with scope and throttle', () => {
      const definition: ToolDefinition = {
        name: 'scoped-tool',
        description: 'A scoped tool',
        scope: 'admin',
        throttle: { maxCalls: 10, windowMs: 60000 },
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);
      expect(registry.list()).toEqual([
        {
          name: 'scoped-tool',
          description: 'A scoped tool',
          scope: 'admin',
          throttle: { maxCalls: 10, windowMs: 60000 },
          hasSchema: false,
          hasHooks: false,
        },
      ]);
    });

    it('should throw error for duplicate registration', () => {
      const definition: ToolDefinition = {
        name: 'test-tool',
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);
      expect(() => registry.register(definition)).toThrow("Tool 'test-tool' is already registered");
    });

    it('should clear all tools', () => {
      const definition: ToolDefinition = {
        name: 'test-tool',
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.has('test-tool')).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('should return empty capabilities when no tools registered', () => {
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should return tools capability when tools are registered', () => {
      const definition: ToolDefinition = {
        name: 'test-tool',
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);
      expect(registry.getCapabilities()).toEqual({ tools: {} });
    });
  });

  describe('execute', () => {
    const mockContext: HandlerContext = {
      request: { method: 'tools/call', id: 'test' } as any,
      send: async () => {
        return;
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should execute registered tool', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const definition: ToolDefinition = {
        name: 'test-tool',
        handler,
      };

      registry.register(definition);
      const result = await registry.execute('test-tool', { arg: 'value' }, mockContext);

      expect(result).toEqual({ result: 'success' });
      expect(handler).toHaveBeenCalledWith(
        { arg: 'value' },
        expect.objectContaining({
          ...mockContext,
          registry: {
            kind: 'tools',
            metadata: {
              toolName: 'test-tool',
              scope: undefined,
              throttle: undefined,
            },
          },
        })
      );
    });

    it('should throw error for unknown tool', async () => {
      await expect(registry.execute('unknown-tool', {}, mockContext)).rejects.toThrow("Tool 'unknown-tool' not found");
    });

    it('should validate input schema', async () => {
      const schema = z.object({ name: z.string() });
      const definition: ToolDefinition = {
        name: 'test-tool',
        inputSchema: schema,
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);

      await expect(registry.execute('test-tool', { name: 'test' }, mockContext)).resolves.toEqual({ result: 'success' });

      await expect(registry.execute('test-tool', { invalid: 'data' }, mockContext)).rejects.toThrow("Invalid input for tool 'test-tool'");
    });

    it('should enforce scope authorization', async () => {
      const definition: ToolDefinition = {
        name: 'admin-tool',
        scope: 'admin',
        handler: async () => ({ result: 'success' }),
      };

      registry.register(definition);

      await expect(registry.execute('admin-tool', {}, mockContext, 'admin')).resolves.toEqual({ result: 'success' });

      await expect(registry.execute('admin-tool', {}, mockContext, 'user')).rejects.toThrow(
        "Tool 'admin-tool' requires scope 'admin' but got 'user'"
      );

      await expect(registry.execute('admin-tool', {}, mockContext)).rejects.toThrow(
        "Tool 'admin-tool' requires scope 'admin' but got 'none'"
      );
    });

    it('should include throttle metadata in context', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const throttle = { maxCalls: 5, windowMs: 30000 };
      const definition: ToolDefinition = {
        name: 'throttled-tool',
        throttle,
        handler,
      };

      registry.register(definition);
      await registry.execute('throttled-tool', {}, mockContext);

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          registry: {
            kind: 'tools',
            metadata: {
              toolName: 'throttled-tool',
              scope: undefined,
              throttle,
            },
          },
        })
      );
    });
  });

  describe('enhanced features', () => {
    const mockContext: HandlerContext = {
      request: { method: 'tools/call', id: 'test' } as any,
      send: async () => {
        // No-op for testing
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should support parameters-based validation', async () => {
      const toolParameters: ToolParameter[] = [
        {
          name: 'action',
          type: 'string',
          required: true,
          enum: ['create', 'update', 'delete'],
          schema: z.enum(['create', 'update', 'delete']),
        },
        { name: 'data', type: 'object', required: false, schema: z.object({ id: z.string() }) },
      ];

      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const definition: ToolDefinition = {
        name: 'test-tool',
        parameters: toolParameters,
        handler,
      };

      registry.register(definition);

      await expect(registry.execute('test-tool', { action: 'create', data: { id: 'test' } }, mockContext)).resolves.toEqual({
        result: 'success',
      });

      await expect(registry.execute('test-tool', { data: { id: 'test' } }, mockContext)).rejects.toThrow(
        "Missing required parameter 'action' for tool 'test-tool'"
      );

      await expect(registry.execute('test-tool', { action: 'invalid' }, mockContext)).rejects.toThrow(
        "Invalid value for parameter 'action' in tool 'test-tool'"
      );
    });

    it('should support enhanced scopes authorization', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const definition: ToolDefinition = {
        name: 'scoped-tool',
        scopes: ['admin', 'moderator'],
        handler,
      };

      registry.register(definition);

      const authorizedContext: HandlerContext = {
        ...mockContext,
        user: { permissions: ['admin', 'read'] },
      };
      await expect(registry.execute('scoped-tool', {}, authorizedContext)).resolves.toEqual({ result: 'success' });

      const unauthorizedContext: HandlerContext = {
        ...mockContext,
        user: { permissions: ['read', 'write'] },
      };
      await expect(registry.execute('scoped-tool', {}, unauthorizedContext)).rejects.toThrow(
        "Tool 'scoped-tool' requires one of scopes [admin, moderator] but user has [read, write]"
      );
    });

    it('should enforce dangerous tool permissions', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const definition: ToolDefinition = {
        name: 'dangerous-tool',
        dangerous: true,
        handler,
      };

      registry.register(definition);

      const authorizedContext: HandlerContext = {
        ...mockContext,
        user: { permissions: ['dangerous-tools'] },
      };
      await expect(registry.execute('dangerous-tool', {}, authorizedContext)).resolves.toEqual({ result: 'success' });

      const unauthorizedContext: HandlerContext = {
        ...mockContext,
        user: { permissions: ['read', 'write'] },
      };
      await expect(registry.execute('dangerous-tool', {}, unauthorizedContext)).rejects.toThrow(
        "Tool 'dangerous-tool' is marked as dangerous and requires 'dangerous-tools' permission"
      );
    });

    it('should execute lifecycle hooks', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();
      const handler = jest.fn().mockResolvedValue({ result: 'success' });

      const definition: ToolDefinition = {
        name: 'hooks-tool',
        handler,
        hooks: {
          beforeExecution: beforeHook,
          afterExecution: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      const result = await registry.execute('hooks-tool', { test: 'data' }, mockContext);

      expect(beforeHook).toHaveBeenCalledWith({ test: 'data' }, expect.any(Object));
      expect(afterHook).toHaveBeenCalledWith({ result: 'success' }, expect.any(Object));
      expect(errorHook).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });

    it('should execute error hook on failure', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();
      const error = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(error);

      const definition: ToolDefinition = {
        name: 'error-hooks-tool',
        handler,
        hooks: {
          beforeExecution: beforeHook,
          afterExecution: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      await expect(registry.execute('error-hooks-tool', { test: 'data' }, mockContext)).rejects.toThrow('Handler failed');

      expect(beforeHook).toHaveBeenCalled();
      expect(afterHook).not.toHaveBeenCalled();
      expect(errorHook).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should include enhanced metadata in context', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });
      const definition: ToolDefinition = {
        name: 'metadata-tool',
        version: '2.0.0',
        tags: ['test', 'demo'],
        dangerous: true,
        scopes: ['admin'],
        rateLimit: { maxCalls: 100, windowMs: 60000 },
        handler,
      };

      registry.register(definition);

      const contextWithPermissions: HandlerContext = {
        ...mockContext,
        user: { permissions: ['admin', 'dangerous-tools'] },
      };

      await registry.execute('metadata-tool', {}, contextWithPermissions);

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          registry: expect.objectContaining({
            kind: 'tools',
            metadata: expect.objectContaining({
              toolName: 'metadata-tool',
              version: '2.0.0',
              tags: ['test', 'demo'],
              dangerous: true,
              scopes: ['admin'],
              rateLimit: { maxCalls: 100, windowMs: 60000 },
            }),
          }),
          execution: expect.objectContaining({
            executionId: expect.stringMatching(/^tool-metadata-tool-\d+-[a-z0-9]+$/),
            startTime: expect.any(Date),
            metadata: { toolName: 'metadata-tool' },
          }),
        })
      );
    });
  });

  describe('enhanced registry methods', () => {
    beforeEach(() => {
      registry.clear();
    });

    it('should support enhanced listing with filtering', () => {
      const dangerousTool: ToolDefinition = {
        name: 'dangerous-tool',
        description: 'A dangerous tool',
        tags: ['dangerous', 'admin'],
        dangerous: true,
        handler: async () => ({ result: 'success' }),
      };

      const scopedTool: ToolDefinition = {
        name: 'scoped-tool',
        description: 'A scoped tool',
        tags: ['scoped'],
        scopes: ['admin'],
        inputSchema: z.object({ name: z.string() }),
        handler: async () => ({ result: 'success' }),
      };

      registry.register(dangerousTool);
      registry.register(scopedTool);

      const dangerousResults = registry.list({ dangerous: true });
      expect(dangerousResults).toHaveLength(1);
      expect(dangerousResults[0]?.name).toBe('dangerous-tool');
      expect(dangerousResults[0]?.dangerous).toBe(true);

      const tagResults = registry.list({ tags: ['scoped'] });
      expect(tagResults).toHaveLength(1);
      expect(tagResults[0]?.name).toBe('scoped-tool');

      const scopeResults = registry.list({ withScope: true });
      expect(scopeResults).toHaveLength(1);
      expect(scopeResults[0]?.name).toBe('scoped-tool');

      const schemaResults = registry.list({ withSchema: true });
      expect(schemaResults).toHaveLength(1);
      expect(schemaResults[0]?.hasSchema).toBe(true);
    });

    it('should get tools by tags', () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        tags: ['tag1', 'tag2'],
        handler: async () => ({ result: 'success' }),
      };

      const tool2: ToolDefinition = {
        name: 'tool2',
        tags: ['tag2', 'tag3'],
        handler: async () => ({ result: 'success' }),
      };

      registry.register(tool1);
      registry.register(tool2);

      const results = registry.getByTags(['tag2']);
      expect(results).toHaveLength(2);
      expect(results).toContain('tool1');
      expect(results).toContain('tool2');

      const specificResults = registry.getByTags(['tag1']);
      expect(specificResults).toHaveLength(1);
      expect(specificResults).toContain('tool1');
    });

    it('should get tools by scope', () => {
      const legacyScopeTool: ToolDefinition = {
        name: 'legacy-tool',
        scope: 'admin',
        handler: async () => ({ result: 'success' }),
      };

      const newScopesTool: ToolDefinition = {
        name: 'new-tool',
        scopes: ['admin', 'moderator'],
        handler: async () => ({ result: 'success' }),
      };

      registry.register(legacyScopeTool);
      registry.register(newScopesTool);

      const adminTools = registry.getByScope('admin');
      expect(adminTools).toHaveLength(2);
      expect(adminTools).toContain('legacy-tool');
      expect(adminTools).toContain('new-tool');

      const moderatorTools = registry.getByScope('moderator');
      expect(moderatorTools).toHaveLength(1);
      expect(moderatorTools).toContain('new-tool');
    });

    it('should get dangerous tools', () => {
      const safeTool: ToolDefinition = {
        name: 'safe-tool',
        handler: async () => ({ result: 'success' }),
      };

      const dangerousTool: ToolDefinition = {
        name: 'dangerous-tool',
        dangerous: true,
        handler: async () => ({ result: 'success' }),
      };

      registry.register(safeTool);
      registry.register(dangerousTool);

      const dangerousTools = registry.getDangerousTools();
      expect(dangerousTools).toHaveLength(1);
      expect(dangerousTools).toContain('dangerous-tool');
    });

    it('should validate tool definitions', () => {
      const validDefinition: ToolDefinition = {
        name: 'valid-tool',
        description: 'A valid tool',
        version: '1.0.0',
        handler: async () => ({ result: 'success' }),
      };

      const validResult = registry.validateDefinition(validDefinition);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidDefinition = {
        handler: async () => ({ result: 'success' }),
      } as unknown as ToolDefinition;

      const invalidResult = registry.validateDefinition(invalidDefinition);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Tool name is required and must be a string');

      const badVersionDefinition: ToolDefinition = {
        name: 'bad-version',
        version: 'invalid',
        handler: async () => ({ result: 'success' }),
      };

      const badVersionResult = registry.validateDefinition(badVersionDefinition);
      expect(badVersionResult.valid).toBe(false);
      expect(badVersionResult.errors).toContain('Version must follow semantic versioning format (e.g., 1.0.0)');
    });

    it('should get detailed capabilities', () => {
      const dangerousTool: ToolDefinition = {
        name: 'dangerous-tool',
        dangerous: true,
        handler: async () => ({ result: 'success' }),
      };

      const validatedTool: ToolDefinition = {
        name: 'validated-tool',
        inputSchema: z.object({ name: z.string() }),
        scopes: ['admin'],
        hooks: {
          beforeExecution: async () => {
            // No-op for testing
          },
        },
        handler: async () => ({ result: 'success' }),
      };

      registry.register(dangerousTool);
      registry.register(validatedTool);

      const capabilities = registry.getDetailedCapabilities();
      expect(capabilities.totalTools).toBe(2);
      expect(capabilities.dangerousTools).toBe(1);
      expect(capabilities.toolsWithValidation).toBe(1);
      expect(capabilities.toolsWithHooks).toBe(1);
      expect(capabilities.toolsWithScopes).toBe(1);
    });

    it('should provide enhanced statistics', () => {
      const complexTool: ToolDefinition = {
        name: 'complex-tool',
        description: 'A complex tool',
        version: '2.0.0',
        tags: ['complex', 'test'],
        dangerous: true,
        scopes: ['admin', 'moderator'],
        inputSchema: z.object({ query: z.string() }),
        cache: { enabled: true, ttl: 300 },
        rateLimit: { maxCalls: 100, windowMs: 60000 },
        throttle: { maxCalls: 50, windowMs: 30000 },
        hooks: {
          beforeExecution: async () => {
            // No-op for testing
          },
          afterExecution: async () => {
            // No-op for testing
          },
        },
        handler: async () => ({ result: 'success' }),
      };

      registry.register(complexTool);

      const stats = registry.getStats();
      expect(stats.totalRegistered).toBe(1);
      expect(stats.customMetrics?.toolsWithSchema).toBe(1);
      expect(stats.customMetrics?.toolsWithDescription).toBe(1);
      expect(stats.customMetrics?.toolsWithTags).toBe(1);
      expect(stats.customMetrics?.toolsWithVersion).toBe(1);
      expect(stats.customMetrics?.dangerousTools).toBe(1);
      expect(stats.customMetrics?.toolsWithScopes).toBe(1);
      expect(stats.customMetrics?.toolsWithHooks).toBe(1);
      expect(stats.customMetrics?.toolsWithCaching).toBe(1);
      expect(stats.customMetrics?.toolsWithRateLimit).toBe(1);
      expect(stats.customMetrics?.toolsWithThrottle).toBe(1);
      expect(stats.customMetrics?.uniqueTags).toBe(2);
      expect(stats.customMetrics?.averageTagsPerTool).toBe(2);
      expect(stats.customMetrics?.averageScopesPerTool).toBe(2);
    });
  });
});
