import type { StreamingRequestContext, ToolDefinition } from '@hexmcp/core';
import { z } from 'zod';
import { createNote } from '../domain/notes.js';

const AddNoteInputSchema = z.object({
  title: z.string().min(1, 'Title is required and cannot be empty').max(200, 'Title cannot exceed 200 characters').trim(),
  content: z.string().min(1, 'Content is required and cannot be empty').max(10000, 'Content cannot exceed 10,000 characters').trim(),
});

export const addNoteTool: Omit<ToolDefinition, 'name'> = {
  description: 'Create a new note with title and content',
  parameters: [
    {
      name: 'title',
      description: 'The title of the note (max 200 characters)',
      required: true,
      type: 'string',
    },
    {
      name: 'content',
      description: 'The content/body of the note (max 10,000 characters)',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: AddNoteInputSchema,
  tags: ['notes', 'create'],
  version: '1.0.0',
  handler: async (args, context) => {
    try {
      // Demonstrate streaming info (safe for stdio transport - will be undefined)
      const streamingCtx = context as StreamingRequestContext;

      streamingCtx.streamInfo?.('Validating note input...');
      const validatedInput = AddNoteInputSchema.parse(args);

      streamingCtx.streamInfo?.('Creating note in storage...');
      const note = createNote(validatedInput);

      streamingCtx.streamInfo?.('Note creation completed successfully');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created note with ID: ${note.id}`,
          },
        ],
        isError: false,
        metadata: {
          noteId: note.id,
          createdAt: note.createdAt.toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${errorMessages}`,
            },
          ],
          isError: true,
        };
      }

      if (error instanceof Error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating note: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: 'An unexpected error occurred while creating the note',
          },
        ],
        isError: true,
      };
    }
  },
};
