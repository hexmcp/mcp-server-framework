import { join } from 'node:path';
import { listFixturePaths, loadFixture, runFixture } from '../src/run-fixtures';

const fixturesDir = join(__dirname, '..', 'fixtures');

describe('Fixture Tests', () => {
  it('should run all fixtures in the fixtures directory', async () => {
    let fixturePaths: string[] = [];

    try {
      fixturePaths = await listFixturePaths(fixturesDir);
    } catch {
      console.warn('No fixtures directory found, skipping fixture tests');
      return;
    }

    if (fixturePaths.length === 0) {
      console.warn('No fixture files found in fixtures directory');
      return;
    }

    const results: Array<{ name: string; path: string; success: boolean; error?: Error }> = [];

    for (const filePath of fixturePaths) {
      try {
        const fixture = await loadFixture(filePath);
        await runFixture(filePath);
        results.push({ name: fixture.name, path: filePath, success: true });
      } catch (error) {
        results.push({
          name: `INVALID: ${filePath}`,
          path: filePath,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      const failureMessages = failures.map((f) => `${f.name}: ${f.error?.message}`).join('\n');
      throw new Error(`${failures.length} fixture(s) failed:\n${failureMessages}`);
    }

    console.log(`✅ All ${results.length} fixtures passed`);
  });
});
