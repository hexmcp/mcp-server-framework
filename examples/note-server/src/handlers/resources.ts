import type { ResourceDefinition } from '@hexmcp/core';
import { getAllNotes, getNoteById } from '../domain/notes.js';

export const notesResource: Omit<ResourceDefinition, 'uriPattern'> = {
  name: 'Notes',
  description: 'Access and list notes stored in the server',
  mimeType: 'application/json',
  tags: ['notes', 'data'],
  version: '1.0.0',
  provider: {
    get: async (uri, _context) => {
      try {
        const url = new URL(uri);

        if (url.pathname === '/') {
          const notes = getAllNotes();
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                notes: notes.map((note) => ({
                  id: note.id,
                  title: note.title,
                  content: note.content,
                  createdAt: note.createdAt.toISOString(),
                  updatedAt: note.updatedAt.toISOString(),
                })),
                count: notes.length,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          };
        }

        const noteId = url.pathname.substring(1);
        if (!noteId) {
          throw new Error('Note ID is required in the URI path');
        }

        const note = getNoteById(noteId);
        if (!note) {
          throw new Error(`Note with ID '${noteId}' not found`);
        }

        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              id: note.id,
              title: note.title,
              content: note.content,
              createdAt: note.createdAt.toISOString(),
              updatedAt: note.updatedAt.toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to get note resource: ${error.message}`);
        }
        throw new Error('An unexpected error occurred while accessing the note resource');
      }
    },

    list: async (cursor, _context) => {
      try {
        const notes = getAllNotes();
        const limit = 10;
        const offset = cursor ? parseInt(cursor, 10) : 0;

        if (Number.isNaN(offset) || offset < 0) {
          throw new Error('Invalid cursor: must be a non-negative number');
        }

        const paginatedNotes = notes.slice(offset, offset + limit);
        const hasMore = offset + limit < notes.length;

        const result = {
          resources: paginatedNotes.map((note) => ({
            uri: `notes://${note.id}`,
            name: note.title,
            description: `Note created on ${note.createdAt.toLocaleDateString()}`,
            mimeType: 'application/json',
          })),
          ...(hasMore && { nextCursor: String(offset + limit) }),
        };

        return result;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to list note resources: ${error.message}`);
        }
        throw new Error('An unexpected error occurred while listing note resources');
      }
    },
  },
  validateUri: (uri) => {
    try {
      const url = new URL(uri);

      if (url.protocol !== 'notes:') {
        return {
          success: false,
          errors: [{ path: ['uri'], message: 'URI must use the notes:// protocol' }],
        };
      }

      if (url.hostname !== '') {
        return {
          success: false,
          errors: [{ path: ['uri'], message: 'URI hostname must be empty for notes protocol' }],
        };
      }

      const path = url.pathname;
      if (path !== '/' && !path.match(/^\/[a-f0-9-]{36}$/)) {
        return {
          success: false,
          errors: [
            {
              path: ['uri'],
              message: 'URI path must be "/" for listing or "/{uuid}" for specific note',
            },
          ],
        };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        errors: [{ path: ['uri'], message: 'Invalid URI format' }],
      };
    }
  },
};
