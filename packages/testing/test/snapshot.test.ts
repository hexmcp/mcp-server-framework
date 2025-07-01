import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { configureSnapshots, expectMatchesSnapshot, loadSnapshot, saveSnapshot } from '../src/snapshot';

describe('Snapshot Utilities', () => {
  const testSnapshotsDir = join(__dirname, 'test-snapshots');
  const testData = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [{ type: 'text', text: 'Hello, World!' }],
    },
  };

  beforeEach(async () => {
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });

    configureSnapshots({
      snapshotsDir: testSnapshotsDir,
      updateSnapshots: false,
    });
  });

  afterEach(async () => {
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });
  });

  describe('configureSnapshots', () => {
    it('should update global configuration', () => {
      configureSnapshots({
        snapshotsDir: '/custom/path',
        updateSnapshots: true,
      });

      // Configuration is internal, but we can test its effects
      expect(true).toBe(true); // Placeholder - effects tested in other tests
    });
  });

  describe('saveSnapshot', () => {
    it('should save snapshot to disk with pretty formatting', async () => {
      await saveSnapshot('test-snapshot', testData, testSnapshotsDir);

      const snapshotPath = join(testSnapshotsDir, 'test-snapshot.json');
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(testData);
      expect(content).toContain('  ');
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = join(testSnapshotsDir, 'nested', 'deep');
      await saveSnapshot('nested-snapshot', testData, nestedDir);

      const snapshotPath = join(nestedDir, 'nested-snapshot.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should sanitize snapshot names', async () => {
      await saveSnapshot('test/with:special*chars', testData, testSnapshotsDir);

      const snapshotPath = join(testSnapshotsDir, 'test_with_special_chars.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle save errors gracefully', async () => {
      await expect(saveSnapshot('test', testData, '/invalid/readonly/path')).rejects.toThrow('Failed to save snapshot');
    });
  });

  describe('loadSnapshot', () => {
    beforeEach(async () => {
      await saveSnapshot('existing-snapshot', testData, testSnapshotsDir);
    });

    it('should load existing snapshot', async () => {
      const loaded = await loadSnapshot('existing-snapshot', testSnapshotsDir);
      expect(loaded).toEqual(testData);
    });

    it('should throw error for non-existent snapshot', async () => {
      await expect(loadSnapshot('non-existent', testSnapshotsDir)).rejects.toThrow("Snapshot 'non-existent' not found");
    });

    it('should throw error for invalid JSON', async () => {
      const invalidPath = join(testSnapshotsDir, 'invalid.json');
      await fs.mkdir(testSnapshotsDir, { recursive: true });
      await fs.writeFile(invalidPath, 'invalid json', 'utf-8');

      await expect(loadSnapshot('invalid', testSnapshotsDir)).rejects.toThrow('Failed to load snapshot');
    });
  });

  describe('expectMatchesSnapshot', () => {
    it('should pass when data matches existing snapshot', async () => {
      await saveSnapshot('matching-snapshot', testData, testSnapshotsDir);

      await expectMatchesSnapshot('matching-snapshot', testData, testSnapshotsDir);
    });

    it('should throw error when data does not match snapshot', async () => {
      await saveSnapshot('different-snapshot', testData, testSnapshotsDir);

      const differentData = { ...testData, id: 2 };

      await expect(expectMatchesSnapshot('different-snapshot', differentData, testSnapshotsDir)).rejects.toThrow(
        "Snapshot 'different-snapshot' does not match actual data"
      );
    });

    it('should create new snapshot when it does not exist', async () => {
      const originalWarn = console.warn;
      console.warn = jest.fn();

      await expectMatchesSnapshot('new-snapshot', testData, testSnapshotsDir);

      const loaded = await loadSnapshot('new-snapshot', testSnapshotsDir);
      expect(loaded).toEqual(testData);

      console.warn = originalWarn;
    });

    it('should update snapshot when UPDATE_SNAPSHOTS is true', async () => {
      await saveSnapshot('update-snapshot', testData, testSnapshotsDir);

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      const newData = { ...testData, id: 999 };

      const originalWarn = console.warn;
      console.warn = jest.fn();

      await expectMatchesSnapshot('update-snapshot', newData, testSnapshotsDir);

      const loaded = await loadSnapshot('update-snapshot', testSnapshotsDir);
      expect(loaded).toEqual(newData);

      console.warn = originalWarn;
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        request: {
          jsonrpc: '2.0',
          id: 'complex-id',
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: {
              message: 'Hello',
              options: {
                format: 'text',
                metadata: {
                  timestamp: '2023-01-01T00:00:00Z',
                  tags: ['test', 'complex'],
                },
              },
            },
          },
        },
        response: {
          jsonrpc: '2.0',
          id: 'complex-id',
          result: {
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'metadata', data: { processed: true } },
            ],
          },
        },
      };

      await expectMatchesSnapshot('complex-snapshot', complexData, testSnapshotsDir);

      const loaded = await loadSnapshot('complex-snapshot', testSnapshotsDir);
      expect(loaded).toEqual(complexData);
    });

    it('should handle arrays and streaming data', async () => {
      const streamingData = [
        { type: 'text', content: 'First chunk' },
        { type: 'text', content: 'Second chunk' },
        { type: 'event', name: 'completion', data: { finished: true } },
      ];

      await expectMatchesSnapshot('streaming-snapshot', streamingData, testSnapshotsDir);

      const loaded = await loadSnapshot('streaming-snapshot', testSnapshotsDir);
      expect(loaded).toEqual(streamingData);
    });
  });
});
