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
      expect(registry.list()).toEqual([
        {
          name: 'test-prompt',
          description: 'A test prompt',
          hasSchema: false,
          hasHooks: false,
        },
      ]);
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

  describe('enhanced registry methods', () => {
    beforeEach(() => {
      registry.clear();
    });

    it('should support enhanced listing with filtering', () => {
      const streamingPrompt: PromptDefinition = {
        name: 'streaming-prompt',
        description: 'A streaming prompt',
        tags: ['streaming', 'test'],
        streaming: true,
        handler: async () => 'response',
      };

      const validatedPrompt: PromptDefinition = {
        name: 'validated-prompt',
        description: 'A validated prompt',
        tags: ['validation'],
        inputSchema: z.object({ name: z.string() }),
        handler: async () => 'response',
      };

      registry.register(streamingPrompt);
      registry.register(validatedPrompt);

      // Test filtering by streaming
      const streamingResults = registry.list({ streaming: true });
      expect(streamingResults).toHaveLength(1);
      expect(streamingResults[0]?.name).toBe('streaming-prompt');
      expect(streamingResults[0]?.streaming).toBe(true);

      // Test filtering by tags
      const tagResults = registry.list({ tags: ['validation'] });
      expect(tagResults).toHaveLength(1);
      expect(tagResults[0]?.name).toBe('validated-prompt');

      // Test filtering by schema
      const schemaResults = registry.list({ withSchema: true });
      expect(schemaResults).toHaveLength(1);
      expect(schemaResults[0]?.hasSchema).toBe(true);
    });

    it('should get prompts by tags', () => {
      const prompt1: PromptDefinition = {
        name: 'prompt1',
        tags: ['tag1', 'tag2'],
        handler: async () => 'response',
      };

      const prompt2: PromptDefinition = {
        name: 'prompt2',
        tags: ['tag2', 'tag3'],
        handler: async () => 'response',
      };

      registry.register(prompt1);
      registry.register(prompt2);

      const results = registry.getByTags(['tag2']);
      expect(results).toHaveLength(2);
      expect(results).toContain('prompt1');
      expect(results).toContain('prompt2');

      const specificResults = registry.getByTags(['tag1']);
      expect(specificResults).toHaveLength(1);
      expect(specificResults).toContain('prompt1');
    });

    it('should get all unique tags', () => {
      const prompt1: PromptDefinition = {
        name: 'prompt1',
        tags: ['tag1', 'tag2'],
        handler: async () => 'response',
      };

      const prompt2: PromptDefinition = {
        name: 'prompt2',
        tags: ['tag2', 'tag3'],
        handler: async () => 'response',
      };

      registry.register(prompt1);
      registry.register(prompt2);

      const tags = registry.getAllTags();
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should unregister prompts', () => {
      const definition: PromptDefinition = {
        name: 'test-prompt',
        handler: async () => 'response',
      };

      registry.register(definition);
      expect(registry.has('test-prompt')).toBe(true);

      const result = registry.unregister('test-prompt');
      expect(result).toBe(true);
      expect(registry.has('test-prompt')).toBe(false);

      const secondResult = registry.unregister('test-prompt');
      expect(secondResult).toBe(false);
    });

    it('should validate prompt definitions', () => {
      // Valid definition
      const validDefinition: PromptDefinition = {
        name: 'valid-prompt',
        description: 'A valid prompt',
        version: '1.0.0',
        handler: async () => 'response',
      };

      const validResult = registry.validateDefinition(validDefinition);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid definition - missing name
      const invalidDefinition = {
        handler: async () => 'response',
      } as unknown as PromptDefinition;

      const invalidResult = registry.validateDefinition(invalidDefinition);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Prompt name is required and must be a string');

      // Invalid definition - bad version format
      const badVersionDefinition: PromptDefinition = {
        name: 'bad-version',
        version: 'invalid',
        handler: async () => 'response',
      };

      const badVersionResult = registry.validateDefinition(badVersionDefinition);
      expect(badVersionResult.valid).toBe(false);
      expect(badVersionResult.errors).toContain('Version must follow semantic versioning format (e.g., 1.0.0)');
    });

    it('should get detailed capabilities', () => {
      const streamingPrompt: PromptDefinition = {
        name: 'streaming-prompt',
        streaming: true,
        handler: async () => 'response',
      };

      const validatedPrompt: PromptDefinition = {
        name: 'validated-prompt',
        inputSchema: z.object({ name: z.string() }),
        hooks: {
          beforeExecution: async () => {
            // No-op for testing
          },
        },
        handler: async () => 'response',
      };

      registry.register(streamingPrompt);
      registry.register(validatedPrompt);

      const capabilities = registry.getDetailedCapabilities();
      expect(capabilities.totalPrompts).toBe(2);
      expect(capabilities.streamingPrompts).toBe(1);
      expect(capabilities.promptsWithValidation).toBe(1);
      expect(capabilities.promptsWithHooks).toBe(1);
      expect(capabilities.capabilities.prompts?.streaming).toBe(true);
    });

    it('should provide enhanced statistics', () => {
      const complexPrompt: PromptDefinition = {
        name: 'complex-prompt',
        description: 'A complex prompt',
        version: '2.0.0',
        tags: ['complex', 'test'],
        streaming: true,
        inputSchema: z.object({ query: z.string() }),
        cache: { enabled: true, ttl: 300 },
        rateLimit: { maxCalls: 100, windowMs: 60000 },
        hooks: {
          beforeExecution: async () => {
            // No-op for testing
          },
          afterExecution: async () => {
            // No-op for testing
          },
        },
        handler: async () => 'response',
      };

      registry.register(complexPrompt);

      const stats = registry.getStats();
      expect(stats.totalRegistered).toBe(1);
      expect(stats.customMetrics?.promptsWithSchema).toBe(1);
      expect(stats.customMetrics?.promptsWithDescription).toBe(1);
      expect(stats.customMetrics?.promptsWithTags).toBe(1);
      expect(stats.customMetrics?.promptsWithVersion).toBe(1);
      expect(stats.customMetrics?.streamingPrompts).toBe(1);
      expect(stats.customMetrics?.promptsWithHooks).toBe(1);
      expect(stats.customMetrics?.promptsWithCaching).toBe(1);
      expect(stats.customMetrics?.promptsWithRateLimit).toBe(1);
      expect(stats.customMetrics?.uniqueTags).toBe(2);
      expect(stats.customMetrics?.averageTagsPerPrompt).toBe(2);
    });
  });
});
