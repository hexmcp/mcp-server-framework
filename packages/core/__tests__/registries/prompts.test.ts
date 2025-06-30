import { z } from 'zod';
import { PromptRegistry } from '../../src/registries/prompts';
import type { HandlerContext, PromptDefinition } from '../../src/registries/types';

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
});
