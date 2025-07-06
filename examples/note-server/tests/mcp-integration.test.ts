import { join } from 'node:path';
import { runFixture } from '@hexmcp/testing';

const fixturesDir = join(__dirname, '..', 'fixtures');

describe('MCP Protocol Integration', () => {
  describe('Tools', () => {
    describe('addNote tool', () => {
      it('should handle successful note creation', async () => {
        await runFixture(join(fixturesDir, 'tools', 'add-note.req.json'));
      });

      it('should handle invalid note data', async () => {
        await runFixture(join(fixturesDir, 'tools', 'add-note-invalid.req.json'));
      });

      it('should handle missing content', async () => {
        await runFixture(join(fixturesDir, 'tools', 'add-note-missing-content.req.json'));
      });

      it('should handle empty content', async () => {
        await runFixture(join(fixturesDir, 'tools', 'add-note-empty-content.req.json'));
      });

      it('should handle content with line breaks', async () => {
        await runFixture(join(fixturesDir, 'tools', 'add-note-with-linebreaks.req.json'));
      });
    });
  });

  describe('Resources', () => {
    describe('notes resource', () => {
      it('should list all notes', async () => {
        await runFixture(join(fixturesDir, 'resources', 'list-notes.req.json'));
      });

      it('should get all notes content', async () => {
        await runFixture(join(fixturesDir, 'resources', 'get-all-notes.req.json'));
      });

      it('should get specific note', async () => {
        await runFixture(join(fixturesDir, 'resources', 'get-note.req.json'));
      });

      it('should handle note not found', async () => {
        await runFixture(join(fixturesDir, 'resources', 'get-note-not-found.req.json'));
      });
    });
  });

  describe('Prompts', () => {
    describe('summarizeNote prompt', () => {
      it('should summarize existing note', async () => {
        await runFixture(join(fixturesDir, 'prompts', 'summarize-note.req.json'));
      });

      it('should handle invalid note ID', async () => {
        await runFixture(join(fixturesDir, 'prompts', 'summarize-note-invalid-id.req.json'));
      });

      it('should handle note not found', async () => {
        await runFixture(join(fixturesDir, 'prompts', 'summarize-note-not-found.req.json'));
      });
    });
  });
});
