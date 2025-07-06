import { z } from 'zod';
import { ToolRegistry } from '../../src/registries/tools';
import type { ToolDefinition } from '../../src/registries/types';
import { convertParametersToJsonSchema, convertToMcpTool, convertZodToJsonSchema } from '../../src/registries/types';

describe('MCP Protocol Compliance', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('JSON Schema Conversion', () => {
    it('should convert ToolParameter array to JSON Schema', () => {
      const parameters = [
        {
          name: 'title',
          type: 'string' as const,
          description: 'The title of the note',
          required: true,
        },
        {
          name: 'content',
          type: 'string' as const,
          description: 'The content of the note',
          required: true,
        },
        {
          name: 'tags',
          type: 'array' as const,
          description: 'Optional tags',
          required: false,
        },
      ];

      const schema = convertParametersToJsonSchema(parameters);

      expect(schema).toEqual({
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the note',
          },
          content: {
            type: 'string',
            description: 'The content of the note',
          },
          tags: {
            type: 'array',
            description: 'Optional tags',
          },
        },
        required: ['title', 'content'],
      });
    });

    it('should convert Zod schema to JSON Schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean().optional(),
      });

      const schema = convertZodToJsonSchema(zodSchema);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties?.name?.type).toBe('string');
      expect(schema.properties?.age?.type).toBe('number');
      expect(schema.properties?.active?.type).toBe('boolean');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('age');
      expect(schema.required).not.toContain('active');
    });

    it('should handle empty parameters gracefully', () => {
      const schema = convertParametersToJsonSchema([]);
      expect(schema).toEqual({
        type: 'object',
        properties: {},
      });
    });
  });

  describe('Tool Definition to MCP Tool Conversion', () => {
    it('should convert tool with parameters to MCP format', () => {
      const definition: ToolDefinition = {
        name: 'addNote',
        description: 'Create a new note',
        parameters: [
          {
            name: 'title',
            type: 'string',
            description: 'Note title',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'Note content',
            required: true,
          },
        ],
        handler: async () => ({ content: 'success' }),
      };

      const mcpTool = convertToMcpTool(definition);

      expect(mcpTool).toEqual({
        name: 'addNote',
        description: 'Create a new note',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Note title',
            },
            content: {
              type: 'string',
              description: 'Note content',
            },
          },
          required: ['title', 'content'],
        },
      });
    });

    it('should convert tool with Zod schema to MCP format', () => {
      const zodSchema = z.object({
        message: z.string(),
      });

      const definition: ToolDefinition = {
        name: 'echo',
        description: 'Echo a message',
        inputSchema: zodSchema,
        handler: async () => ({ content: 'success' }),
      };

      const mcpTool = convertToMcpTool(definition);

      expect(mcpTool.name).toBe('echo');
      expect(mcpTool.description).toBe('Echo a message');
      expect(mcpTool.inputSchema.type).toBe('object');
      expect(mcpTool.inputSchema.properties).toBeDefined();
    });

    it('should handle tool without parameters', () => {
      const definition: ToolDefinition = {
        name: 'ping',
        description: 'Simple ping tool',
        handler: async () => ({ content: 'pong' }),
      };

      const mcpTool = convertToMcpTool(definition);

      expect(mcpTool).toEqual({
        name: 'ping',
        description: 'Simple ping tool',
        inputSchema: {
          type: 'object',
        },
      });
    });
  });

  describe('ToolRegistry MCP Compliance', () => {
    it('should return MCP-compliant tools list', () => {
      const definition: ToolDefinition = {
        name: 'testTool',
        description: 'A test tool',
        parameters: [
          {
            name: 'input',
            type: 'string',
            required: true,
          },
        ],
        handler: async () => ({ content: 'test' }),
      };

      registry.register(definition);
      const mcpTools = registry.listMcpTools();

      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0]).toEqual({
        name: 'testTool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
            },
          },
          required: ['input'],
        },
      });
    });

    it('should filter tools by tags in MCP format', () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        tags: ['notes'],
        handler: async () => ({ content: 'test' }),
      };

      const tool2: ToolDefinition = {
        name: 'tool2',
        tags: ['files'],
        handler: async () => ({ content: 'test' }),
      };

      registry.register(tool1);
      registry.register(tool2);

      const notesTools = registry.listMcpTools({ tags: ['notes'] });
      expect(notesTools).toHaveLength(1);
      expect(notesTools[0]?.name).toBe('tool1');
    });

    it('should maintain backward compatibility with legacy list method', () => {
      const definition: ToolDefinition = {
        name: 'legacyTool',
        description: 'A legacy tool',
        tags: ['legacy'],
        version: '1.0.0',
        dangerous: true,
        handler: async () => ({ content: 'test' }),
      };

      registry.register(definition);
      const legacyList = registry.list();

      expect(legacyList).toHaveLength(1);
      expect(legacyList[0]).toMatchObject({
        name: 'legacyTool',
        description: 'A legacy tool',
        tags: ['legacy'],
        version: '1.0.0',
        dangerous: true,
        hasSchema: false,
        hasHooks: false,
      });
    });
  });
});
