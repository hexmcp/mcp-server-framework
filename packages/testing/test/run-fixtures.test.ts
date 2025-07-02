import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { listFixturePaths, loadFixture, runAllFixtures } from '../src/run-fixtures';
import type { Fixture } from '../src/types';

describe('run-fixtures', () => {
  const testFixturesDir = join(__dirname, 'test-fixtures');
  const validFixture: Fixture = {
    name: 'test-fixture',
    input: {
      jsonrpc: '2.0',
      id: 1,
      method: 'test/method',
    },
    expected: {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32000,
        message: "Operational request 'test/method' requires server to be in ready state",
        data: {
          currentState: 'initializing',
          operation: 'test/method',
        },
      },
    },
  };

  beforeAll(async () => {
    await fs.mkdir(testFixturesDir, { recursive: true });
    await fs.mkdir(join(testFixturesDir, 'basic'), { recursive: true });
    await fs.mkdir(join(testFixturesDir, 'prompts'), { recursive: true });

    await fs.writeFile(join(testFixturesDir, 'basic', 'valid.json'), JSON.stringify(validFixture, null, 2));

    await fs.writeFile(
      join(testFixturesDir, 'prompts', 'another.json'),
      JSON.stringify({ ...validFixture, name: 'another-test' }, null, 2)
    );

    await fs.writeFile(join(testFixturesDir, 'invalid.json'), JSON.stringify({ name: 'invalid', missing: 'fields' }, null, 2));
  });

  afterAll(async () => {
    await fs.rm(testFixturesDir, { recursive: true, force: true });
  });

  describe('listFixturePaths', () => {
    it('should recursively find all JSON files', async () => {
      const paths = await listFixturePaths(testFixturesDir);
      expect(paths).toHaveLength(3);
      expect(paths.some((p) => p.includes('basic/valid.json'))).toBe(true);
      expect(paths.some((p) => p.includes('prompts/another.json'))).toBe(true);
      expect(paths.some((p) => p.includes('invalid.json'))).toBe(true);
    });

    it('should return sorted paths', async () => {
      const paths = await listFixturePaths(testFixturesDir);
      const sortedPaths = [...paths].sort();
      expect(paths).toEqual(sortedPaths);
    });

    it('should handle non-existent directory', async () => {
      await expect(listFixturePaths('/non/existent/path')).rejects.toThrow('Failed to read directory');
    });
  });

  describe('loadFixture', () => {
    it('should load valid fixture', async () => {
      const fixturePath = join(testFixturesDir, 'basic', 'valid.json');
      const fixture = await loadFixture(fixturePath);
      expect(fixture).toEqual(validFixture);
    });

    it('should reject invalid fixture', async () => {
      const fixturePath = join(testFixturesDir, 'invalid.json');
      await expect(loadFixture(fixturePath)).rejects.toThrow('Invalid fixture format');
    });

    it('should handle non-existent file', async () => {
      await expect(loadFixture('/non/existent/file.json')).rejects.toThrow('Failed to load fixture');
    });
  });

  describe('runAllFixtures', () => {
    it('should execute all fixtures and return results', async () => {
      const results = await runAllFixtures(testFixturesDir);

      expect(results).toHaveLength(3);
      expect(results.some((result) => result.name === 'test-fixture')).toBe(true);
      expect(results.some((result) => result.name === 'another-test')).toBe(true);
      expect(results.some((result) => result.name.includes('INVALID'))).toBe(true);

      // Check that execution times are recorded
      for (const result of results) {
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      }

      // Check that the valid fixtures passed (they should match the expected lifecycle error)
      const validResults = results.filter((r) => !r.name.includes('INVALID'));
      expect(validResults.every((r) => r.success)).toBe(true);

      // Check that the invalid fixture failed
      const invalidResults = results.filter((r) => r.name.includes('INVALID'));
      expect(invalidResults.every((r) => !r.success)).toBe(true);
    });
  });
});
