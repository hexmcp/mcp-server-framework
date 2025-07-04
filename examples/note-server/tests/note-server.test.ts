import { clearAllNotes, createNote, getAllNotes } from '../src/domain/notes.js';

describe('Note Server', () => {
  beforeEach(() => {
    clearAllNotes();
  });

  describe('Domain Logic', () => {
    it('should create a note successfully', () => {
      const note = createNote({
        title: 'Test Note',
        content: 'This is a test note.',
      });

      expect(note).toBeDefined();
      expect(note.id).toBeDefined();
      expect(note.title).toBe('Test Note');
      expect(note.content).toBe('This is a test note.');
      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.updatedAt).toBeInstanceOf(Date);
    });

    it('should maintain data consistency across operations', () => {
      const note1 = createNote({
        title: 'First Note',
        content: 'Content of the first note',
      });

      const note2 = createNote({
        title: 'Second Note',
        content: 'Content of the second note',
      });

      const allNotes = getAllNotes();
      expect(allNotes).toHaveLength(5); // 3 sample notes + 2 created
      expect(allNotes.find((n) => n.id === note1.id)).toBeDefined();
      expect(allNotes.find((n) => n.id === note2.id)).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', () => {
      expect(() => {
        createNote({ title: '', content: 'test' });
      }).toThrow('Note title is required and cannot be empty');
    });

    it('should validate note content length', () => {
      expect(() => {
        createNote({
          title: 'Test',
          content: 'x'.repeat(10001),
        });
      }).toThrow('Note content cannot exceed 10,000 characters');
    });

    it('should validate note title length', () => {
      expect(() => {
        createNote({
          title: 'x'.repeat(201),
          content: 'test content',
        });
      }).toThrow('Note title cannot exceed 200 characters');
    });
  });
});
