import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { expectMatchesOrUpdateSnapshot, runFixtureWithSnapshotUpdate, updateAllFixtureSnapshots } from '../src/run-fixtures';
import { configureSnapshots } from '../src/snapshot';
import type { Fixture } from '../src/types';

describe('Golden Fixture Testing', () => {
  const testFixturesDir = join(__dirname, 'test-golden-fixtures');
  const testSnapshotsDir = join(__dirname, 'test-golden-snapshots');

  const sampleFixture: Fixture = {
    name: 'golden-test-fixture',
    input: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'test' },
      },
    },
    expected: {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32000,
        message: "Operational request 'tools/call' requires server to be in ready state",
        data: {
          currentState: 'initializing',
          operation: 'tools/call',
        },
      },
    },
  };

  beforeEach(async () => {
    await fs.rm(testFixturesDir, { recursive: true, force: true });
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });
    await fs.mkdir(testFixturesDir, { recursive: true });

    configureSnapshots({
      snapshotsDir: testSnapshotsDir,
      updateSnapshots: false,
    });

    delete process.env.UPDATE_SNAPSHOTS;
  });

  afterEach(async () => {
    await fs.rm(testFixturesDir, { recursive: true, force: true });
    await fs.rm(testSnapshotsDir, { recursive: true, force: true });
    delete process.env.UPDATE_SNAPSHOTS;
  });

  describe('expectMatchesOrUpdateSnapshot', () => {
    it('should compare against snapshot in normal mode', async () => {
      const testData = { test: 'data', value: 123 };

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await expectMatchesOrUpdateSnapshot('test-snapshot', testData);

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: false,
      });

      await expectMatchesOrUpdateSnapshot('test-snapshot', testData);
    });

    it('should update snapshot when UPDATE_SNAPSHOTS is true', async () => {
      const originalData = { test: 'original', value: 100 };
      const updatedData = { test: 'updated', value: 200 };

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await expectMatchesOrUpdateSnapshot('update-test', originalData);

      await expectMatchesOrUpdateSnapshot('update-test', updatedData);

      const snapshotPath = join(testSnapshotsDir, 'update-test.json');
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);

      expect(snapshot).toEqual(updatedData);
    });

    it('should fail when data does not match snapshot', async () => {
      const originalData = { test: 'original' };
      const differentData = { test: 'different' };

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await expectMatchesOrUpdateSnapshot('mismatch-test', originalData);

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: false,
      });

      await expect(expectMatchesOrUpdateSnapshot('mismatch-test', differentData)).rejects.toThrow('does not match actual data');
    });
  });

  describe('runFixtureWithSnapshotUpdate', () => {
    beforeEach(async () => {
      const fixturePath = join(testFixturesDir, 'test-fixture.json');
      await fs.writeFile(fixturePath, JSON.stringify(sampleFixture, null, 2));
    });

    it('should run fixture normally when UPDATE_SNAPSHOTS is false', async () => {
      process.env.UPDATE_SNAPSHOTS = 'false';

      const fixturePath = join(testFixturesDir, 'test-fixture.json');

      await runFixtureWithSnapshotUpdate(fixturePath);
    });

    it('should update snapshot when UPDATE_SNAPSHOTS is true', async () => {
      process.env.UPDATE_SNAPSHOTS = 'true';

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      const fixturePath = join(testFixturesDir, 'test-fixture.json');

      await runFixtureWithSnapshotUpdate(fixturePath);

      const snapshotPath = join(testSnapshotsDir, 'golden-test-fixture.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);
      expect(snapshot).toEqual(sampleFixture.expected);
    });

    it('should use custom snapshot name when provided', async () => {
      process.env.UPDATE_SNAPSHOTS = 'true';

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      const fixturePath = join(testFixturesDir, 'test-fixture.json');

      await runFixtureWithSnapshotUpdate(fixturePath, 'custom-snapshot-name');

      const snapshotPath = join(testSnapshotsDir, 'custom-snapshot-name.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('updateAllFixtureSnapshots', () => {
    beforeEach(async () => {
      const fixtures = [
        { ...sampleFixture, name: 'fixture-1' },
        { ...sampleFixture, name: 'fixture-2' },
        { ...sampleFixture, name: 'fixture-3' },
      ];

      for (const fixture of fixtures) {
        const fixturePath = join(testFixturesDir, `${fixture.name}.json`);
        await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2));
      }
    });

    it('should update all fixture snapshots', async () => {
      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await updateAllFixtureSnapshots(testFixturesDir);

      const expectedSnapshots = ['fixture-1.json', 'fixture-2.json', 'fixture-3.json'];

      for (const snapshotFile of expectedSnapshots) {
        const snapshotPath = join(testSnapshotsDir, snapshotFile);
        const exists = await fs
          .access(snapshotPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(snapshotPath, 'utf-8');
        const snapshot = JSON.parse(content);
        expect(snapshot).toEqual(sampleFixture.expected);
      }
    });

    it('should restore original UPDATE_SNAPSHOTS value', async () => {
      const originalValue = 'original-value';
      process.env.UPDATE_SNAPSHOTS = originalValue;

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await updateAllFixtureSnapshots(testFixturesDir);

      expect(process.env.UPDATE_SNAPSHOTS).toBe(originalValue);
    });

    it('should handle fixtures with errors gracefully', async () => {
      // Create a fixture that's missing required fields
      const invalidFixture = {
        name: 'invalid-fixture',
        // Missing 'input' and 'expected' fields
      };

      const invalidFixturePath = join(testFixturesDir, 'invalid.json');
      await fs.writeFile(invalidFixturePath, JSON.stringify(invalidFixture, null, 2));

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await expect(updateAllFixtureSnapshots(testFixturesDir)).rejects.toThrow('fixture snapshot update(s) failed');
    });

    it('should delete UPDATE_SNAPSHOTS if it was not set originally', async () => {
      delete process.env.UPDATE_SNAPSHOTS;

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await updateAllFixtureSnapshots(testFixturesDir);

      expect(process.env.UPDATE_SNAPSHOTS).toBeUndefined();
    });
  });

  describe('environment variable behavior', () => {
    it('should respect UPDATE_SNAPSHOTS=true environment variable', async () => {
      process.env.UPDATE_SNAPSHOTS = 'true';

      const testData = { env: 'test', mode: 'update' };

      await expectMatchesOrUpdateSnapshot('env-test', testData);

      const snapshotPath = join(testSnapshotsDir, 'env-test.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should respect UPDATE_SNAPSHOTS=false environment variable', async () => {
      process.env.UPDATE_SNAPSHOTS = 'false';

      const testData = { env: 'test', mode: 'compare' };

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: true,
      });

      await expectMatchesOrUpdateSnapshot('env-false-test', testData);

      configureSnapshots({
        snapshotsDir: testSnapshotsDir,
        updateSnapshots: false,
      });

      await expectMatchesOrUpdateSnapshot('env-false-test', testData);
    });
  });
});
