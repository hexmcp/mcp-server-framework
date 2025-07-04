import { randomUUID } from 'node:crypto';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateNoteInput = {
  title: string;
  content: string;
};

export type UpdateNoteInput = Partial<CreateNoteInput>;

class NotesStore {
  private notes = new Map<string, Note>();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData(): void {
    const sampleNotes: CreateNoteInput[] = [
      {
        title: 'Welcome to MCP Notes',
        content:
          'This is a sample note demonstrating the MCP Server Framework capabilities. You can create, read, and summarize notes using the available tools, resources, and prompts.',
      },
      {
        title: 'Framework Features',
        content:
          'The MCP Server Framework provides:\n- Tool handlers for executing operations\n- Resource handlers for data access\n- Prompt handlers for content generation\n- Middleware support for cross-cutting concerns\n- Transport abstraction for different protocols',
      },
      {
        title: 'Getting Started',
        content:
          'To get started with this note server:\n1. Use the addNote tool to create new notes\n2. Access notes via the notes:// resource URI\n3. Generate summaries with the summarizeNote prompt\n4. Explore the fixture tests to understand the API',
      },
    ];

    for (const noteInput of sampleNotes) {
      this.create(noteInput);
    }
  }

  create(input: CreateNoteInput): Note {
    const now = new Date();
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };

    this.notes.set(note.id, note);
    return note;
  }

  getById(id: string): Note | undefined {
    return this.notes.get(id);
  }

  getAll(): Note[] {
    return Array.from(this.notes.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  update(id: string, input: UpdateNoteInput): Note | undefined {
    const existingNote = this.notes.get(id);
    if (!existingNote) {
      return undefined;
    }

    const updatedNote: Note = {
      ...existingNote,
      ...input,
      updatedAt: new Date(),
    };

    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  delete(id: string): boolean {
    return this.notes.delete(id);
  }

  count(): number {
    return this.notes.size;
  }

  clear(): void {
    this.notes.clear();
    this.seedSampleData();
  }
}

export const notesStore = new NotesStore();

export function createNote(input: CreateNoteInput): Note {
  if (!input.title?.trim()) {
    throw new Error('Note title is required and cannot be empty');
  }
  if (!input.content?.trim()) {
    throw new Error('Note content is required and cannot be empty');
  }
  if (input.title.length > 200) {
    throw new Error('Note title cannot exceed 200 characters');
  }
  if (input.content.length > 10000) {
    throw new Error('Note content cannot exceed 10,000 characters');
  }

  return notesStore.create(input);
}

export function getNoteById(id: string): Note | undefined {
  if (!id?.trim()) {
    throw new Error('Note ID is required');
  }
  return notesStore.getById(id);
}

export function getAllNotes(): Note[] {
  return notesStore.getAll();
}

export function updateNote(id: string, input: UpdateNoteInput): Note | undefined {
  if (!id?.trim()) {
    throw new Error('Note ID is required');
  }
  if (input.title !== undefined && !input.title.trim()) {
    throw new Error('Note title cannot be empty');
  }
  if (input.content !== undefined && !input.content.trim()) {
    throw new Error('Note content cannot be empty');
  }
  if (input.title && input.title.length > 200) {
    throw new Error('Note title cannot exceed 200 characters');
  }
  if (input.content && input.content.length > 10000) {
    throw new Error('Note content cannot exceed 10,000 characters');
  }

  return notesStore.update(id, input);
}

export function deleteNote(id: string): boolean {
  if (!id?.trim()) {
    throw new Error('Note ID is required');
  }
  return notesStore.delete(id);
}

export function getNotesCount(): number {
  return notesStore.count();
}

export function clearAllNotes(): void {
  notesStore.clear();
}

export function generateNoteSummary(note: Note, maxLength = 100): string {
  const contentPreview = note.content.length > maxLength ? `${note.content.substring(0, maxLength)}...` : note.content;

  return `Note "${note.title}": ${contentPreview}`;
}
