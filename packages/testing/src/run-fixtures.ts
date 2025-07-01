import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { FixtureRunner, runFixture } from './runner';
import type { Fixture } from './types';

// Temporary type for runner options (will be redesigned in later steps)
interface FixtureRunnerOptions {
  timeout?: number;
  verbose?: boolean;
  failFast?: boolean;
  tags?: string[];
}

/**
 * Recursively traverses a given root folder and returns a flat list
 * of absolute file paths to all `.json` files inside nested directories.
 */
export async function listFixturePaths(rootDir: string): Promise<string[]> {
  const resolvedDir = resolve(rootDir);
  const fixturePaths: string[] = [];

  async function traverse(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          fixturePaths.push(fullPath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to read directory ${currentDir}: ${error}`);
    }
  }

  await traverse(resolvedDir);
  return fixturePaths.sort();
}

/**
 * Reads and parses a single JSON file into a `Fixture` object.
 * Validates minimal structure: must include `name`, `input`, and `expected`.
 */
export async function loadFixture(filePath: string): Promise<Fixture> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const fixture: Fixture = JSON.parse(content);

    if (!fixture.name || !fixture.input || !fixture.expected) {
      throw new Error('Invalid fixture format: missing required fields (name, input, expected)');
    }

    return fixture;
  } catch (error) {
    throw new Error(`Failed to load fixture ${filePath}: ${error}`);
  }
}

/**
 * Registers a single `test()` block in Jest using the fixture's `name` and its source file path.
 * Inside the test body, calls the core test engine to send `input` through dispatcher
 * and assert that output equals `expected` (deep equality).
 */
export function runFixtureTest(fixture: Fixture, filePath: string): void {
  test(`${fixture.name} (${filePath})`, async () => {
    await runFixture(filePath);
  });
}

/**
 * Main entry point that combines all steps:
 * 1. Calls `listFixturePaths()` to get all JSON test file paths
 * 2. For each path: loads fixture and executes it
 * Returns results for all fixtures including successes and failures.
 */
export async function runAllFixtures(rootDir = 'fixtures'): Promise<
  Array<{
    name: string;
    path: string;
    success: boolean;
    error?: Error;
    executionTime: number;
  }>
> {
  const fixturePaths = await listFixturePaths(rootDir);
  const results: Array<{
    name: string;
    path: string;
    success: boolean;
    error?: Error;
    executionTime: number;
  }> = [];

  for (const filePath of fixturePaths) {
    const startTime = Date.now();
    try {
      const fixture = await loadFixture(filePath);
      await runFixture(filePath);
      results.push({
        name: fixture.name,
        path: filePath,
        success: true,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      results.push({
        name: `INVALID: ${filePath}`,
        path: filePath,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime: Date.now() - startTime,
      });
    }
  }

  return results;
}

export async function runFixtures(fixtureDir: string, options: FixtureRunnerOptions = {}): Promise<void> {
  const runner = new FixtureRunner(options);
  await runner.loadFixtures(fixtureDir);
  await runner.executeAll();
}

export { FixtureRunner, runFixture } from './runner';
export * from './types';
