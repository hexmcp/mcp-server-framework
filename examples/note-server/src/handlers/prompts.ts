import type { PromptDefinition } from '@hexmcp/core';
import { z } from 'zod';
import { generateNoteSummary, getNoteById } from '../domain/notes.js';

const SummarizeNoteInputSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required').uuid('Note ID must be a valid UUID'),
  maxLength: z
    .number()
    .int('Max length must be an integer')
    .min(50, 'Max length must be at least 50 characters')
    .max(500, 'Max length cannot exceed 500 characters')
    .optional()
    .default(150),
});

export const summarizeNotePrompt: Omit<PromptDefinition, 'name'> = {
  description: 'Generate a summary of a note by its ID',
  arguments: [
    {
      name: 'noteId',
      description: 'The UUID of the note to summarize',
      required: true,
    },
    {
      name: 'maxLength',
      description: 'Maximum length of the summary (50-500 characters, default: 150)',
      required: false,
    },
  ],
  tags: ['notes', 'summary', 'text-generation'],
  version: '1.0.0',
  validate: (args) => {
    try {
      SummarizeNoteInputSchema.parse(args);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map((err) => ({
            path: err.path.map(String),
            message: err.message,
          })),
        };
      }
      return {
        success: false,
        errors: [{ path: [], message: 'Invalid input format' }],
      };
    }
  },
  handler: async (args, _context) => {
    try {
      const validatedInput = SummarizeNoteInputSchema.parse(args);
      const { noteId, maxLength } = validatedInput;

      const note = getNoteById(noteId);
      if (!note) {
        return `Error: Note with ID '${noteId}' not found. Please check the note ID and try again.`;
      }

      const summary = generateNoteSummary(note, maxLength);
      const wordCount = note.content.split(/\s+/).length;
      const charCount = note.content.length;

      return `# Note Summary\n\n**Title:** ${note.title}\n\n**Summary:** ${summary}\n\n**Statistics:**\n- Created: ${note.createdAt.toLocaleDateString()}\n- Word count: ${wordCount}\n- Character count: ${charCount}\n- Last updated: ${note.updatedAt.toLocaleDateString()}`;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        return `Validation error: ${errorMessages}`;
      }

      if (error instanceof Error) {
        return `Error generating summary: ${error.message}`;
      }

      return 'An unexpected error occurred while generating the note summary';
    }
  },
};
