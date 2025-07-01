import { z } from 'zod';
import { PromptRegistry } from '../../src/registries/prompts';
import type { HandlerContext, PromptArgument, PromptDefinition } from '../../src/registries/types';

describe('PromptRegistry', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
  });

  describe('basic functionality', () => {
    it('should have correct kind', () => {
      expect(registry.kind).toBe('prompts');
    });

    it('should start empty', () => {
      expect(registry.size()).toBe(0);
      expect(registry.list()).toEqual([]);
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should register a prompt', () => {
      const definition: PromptDefinition = {
        name: 'test-prompt',
        description: 'A test prompt',
        handler: async () => 'test response',
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);
      expect(registry.has('test-prompt')).toBe(true);
      expect(registry.list()).toEqual([{ name: 'test-prompt', description: 'A test prompt' }]);
    });

    it('should throw error for duplicate registration', () => {
      const definition: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'test response',
      };

      registry.register(definition);
      expect(() => registry.register(definition)).toThrow("Prompt 'test-prompt' is already registered");
    });

    it('should clear all prompts', () => {
      const definition: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'test response',
      };

      registry.register(definition);
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.has('test-prompt')).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('should return empty capabilities when no prompts registered', () => {
      expect(registry.getCapabilities()).toEqual({});
    });

    it('should return prompts capability when prompts are registered', () => {
      const definition: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'test response',
      };

      registry.register(definition);
      expect(registry.getCapabilities()).toEqual({ prompts: {} });
    });
  });

  describe('dispatch', () => {
    const mockContext: HandlerContext = {
      request: { method: 'prompts/get', id: 'test' } as any,
      send: async () => {
        return;
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should dispatch to registered prompt', async () => {
      const handler = jest.fn().mockResolvedValue('test response');
      const definition: PromptDefinition = {
        name: 'test-prompt',
        handler,
      };

      registry.register(definition);
      const result = await registry.dispatch('test-prompt', { arg: 'value' }, mockContext);

      expect(result).toBe('test response');
      expect(handler).toHaveBeenCalledWith(
        { arg: 'value' },
        expect.objectContaining({
          ...mockContext,
          registry: {
            kind: 'prompts',
            metadata: { promptName: 'test-prompt' },
          },
        })
      );
    });

    it('should throw error for unknown prompt', async () => {
      await expect(registry.dispatch('unknown-prompt', {}, mockContext)).rejects.toThrow("Prompt 'unknown-prompt' not found");
    });

    it('should validate input schema', async () => {
      const schema = z.object({ name: z.string() });
      const definition: PromptDefinition = {
        name: 'test-prompt',
        inputSchema: schema,
        handler: async () => 'test response',
      };

      registry.register(definition);

      await expect(registry.dispatch('test-prompt', { name: 'test' }, mockContext)).resolves.toBe('test response');

      await expect(registry.dispatch('test-prompt', { invalid: 'data' }, mockContext)).rejects.toThrow(
        "Invalid input for prompt 'test-prompt'"
      );
    });

    it('should support streaming responses', async () => {
      async function* streamHandler(): AsyncGenerator<string> {
        yield 'chunk1';
        yield 'chunk2';
      }

      const definition: PromptDefinition = {
        name: 'streaming-prompt',
        handler: async () => streamHandler(),
      };

      registry.register(definition);
      const result = await registry.dispatch('streaming-prompt', {}, mockContext);

      expect(result).toBeDefined();
      const chunks: string[] = [];
      for await (const chunk of result as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });
  });

  describe('enhanced features', () => {
    const mockContext: HandlerContext = {
      request: { method: 'prompts/get', id: 'test' } as any,
      send: async () => {
        // No-op for testing
      },
      transport: { name: 'test' },
      state: {},
    };

    it('should support arguments-based validation', async () => {
      const promptArguments: PromptArgument[] = [
        { name: 'name', required: true, schema: z.string() },
        { name: 'age', required: false, schema: z.number() },
      ];

      const handler = jest.fn().mockResolvedValue('test response');
      const definition: PromptDefinition = {
        name: 'test-prompt',
        arguments: promptArguments,
        handler,
      };

      registry.register(definition);

      // Valid input should work
      await expect(registry.dispatch('test-prompt', { name: 'John', age: 30 }, mockContext)).resolves.toBe('test response');

      // Missing required argument should fail
      await expect(registry.dispatch('test-prompt', { age: 30 }, mockContext)).rejects.toThrow(
        "Missing required argument 'name' for prompt 'test-prompt'"
      );

      // Invalid type should fail
      await expect(registry.dispatch('test-prompt', { name: 'John', age: 'thirty' }, mockContext)).rejects.toThrow(
        "Invalid value for argument 'age' in prompt 'test-prompt'"
      );
    });

    it('should support custom validation function', async () => {
      const validate = jest.fn().mockReturnValue({ success: true });
      const handler = jest.fn().mockResolvedValue('test response');
      const definition: PromptDefinition = {
        name: 'custom-validation-prompt',
        validate,
        handler,
      };

      registry.register(definition);
      await registry.dispatch('custom-validation-prompt', { test: 'data' }, mockContext);

      expect(validate).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle validation errors from custom function', async () => {
      const validate = jest.fn().mockReturnValue({
        success: false,
        errors: [{ path: ['name'], message: 'Name is required' }],
      });
      const handler = jest.fn().mockResolvedValue('test response');
      const definition: PromptDefinition = {
        name: 'failing-validation-prompt',
        validate,
        handler,
      };

      registry.register(definition);
      await expect(registry.dispatch('failing-validation-prompt', {}, mockContext)).rejects.toThrow(
        "Invalid input for prompt 'failing-validation-prompt': name: Name is required"
      );
    });

    it('should execute lifecycle hooks', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();
      const handler = jest.fn().mockResolvedValue('test response');

      const definition: PromptDefinition = {
        name: 'hooks-prompt',
        handler,
        hooks: {
          beforeExecution: beforeHook,
          afterExecution: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      const result = await registry.dispatch('hooks-prompt', { test: 'data' }, mockContext);

      expect(beforeHook).toHaveBeenCalledWith({ test: 'data' }, expect.any(Object));
      expect(afterHook).toHaveBeenCalledWith('test response', expect.any(Object));
      expect(errorHook).not.toHaveBeenCalled();
      expect(result).toBe('test response');
    });

    it('should execute error hook on failure', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      const errorHook = jest.fn();
      const error = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(error);

      const definition: PromptDefinition = {
        name: 'error-hooks-prompt',
        handler,
        hooks: {
          beforeExecution: beforeHook,
          afterExecution: afterHook,
          onError: errorHook,
        },
      };

      registry.register(definition);
      await expect(registry.dispatch('error-hooks-prompt', { test: 'data' }, mockContext)).rejects.toThrow('Handler failed');

      expect(beforeHook).toHaveBeenCalled();
      expect(afterHook).not.toHaveBeenCalled();
      expect(errorHook).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should include enhanced metadata in context', async () => {
      const handler = jest.fn().mockResolvedValue('test response');
      const definition: PromptDefinition = {
        name: 'metadata-prompt',
        version: '1.0.0',
        tags: ['test', 'demo'],
        streaming: true,
        handler,
      };

      registry.register(definition);
      await registry.dispatch('metadata-prompt', {}, mockContext);

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          registry: expect.objectContaining({
            kind: 'prompts',
            metadata: expect.objectContaining({
              promptName: 'metadata-prompt',
              version: '1.0.0',
              tags: ['test', 'demo'],
              streaming: true,
            }),
          }),
          execution: expect.objectContaining({
            executionId: expect.stringMatching(/^prompt-metadata-prompt-\d+-[a-z0-9]+$/),
            startTime: expect.any(Date),
            metadata: { promptName: 'metadata-prompt' },
          }),
        })
      );
    });
  });
});
