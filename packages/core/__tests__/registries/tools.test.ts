import { z } from 'zod';
import { ToolRegistry } from '../../src/registries/tools';
import type { HandlerContext, ToolDefinition } from '../../src/registries/types';

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
      expect(registry.list()).toEqual([{ name: 'test-tool', description: 'A test tool', scope: undefined, throttle: undefined }]);
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
});
