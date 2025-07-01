import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { encodeJsonRpcError, RpcError } from '@hexmcp/codec-jsonrpc';
import {
  McpCapabilityRegistry,
  McpLifecycleManager,
  McpMiddlewareEngine,
  McpMiddlewareRegistry,
  McpRequestGate,
  MiddlewareDispatcher,
  MockPrimitiveRegistry,
  type RequestContext,
} from '@hexmcp/core';
import { FixtureRunner, runFixture } from './runner';
import { expectMatchesSnapshot, saveSnapshot } from './snapshot';
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

/**
 * Executes a fixture through the MCP stack and captures the actual response.
 * This is used for golden fixture testing to capture real server responses.
 */
async function executeFixtureAndCaptureResponse(fixture: Fixture): Promise<unknown> {
  // Create test execution context (same as in runner.ts)
  const primitiveRegistry = new MockPrimitiveRegistry();
  const capabilityRegistry = new McpCapabilityRegistry();
  capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
  const lifecycleManager = new McpLifecycleManager(capabilityRegistry);
  const requestGate = new McpRequestGate(lifecycleManager);
  const middlewareRegistry = new McpMiddlewareRegistry();
  const middlewareEngine = new McpMiddlewareEngine();

  const initializeRequest = {
    method: 'initialize' as const,
    params: {
      protocolVersion: '2025-06-18',
      capabilities: { experimental: {}, sampling: {} },
      clientInfo: { name: 'Golden Fixture Client', version: '1.0.0' },
    },
  };

  try {
    lifecycleManager.initialize(initializeRequest);
    // Force the state to ready for testing
    // @ts-ignore - accessing private method for testing
    lifecycleManager._setState?.('ready');
  } catch {
    // Ignore initialization errors for now
  }

  const coreDispatcher = async (ctx: RequestContext) => {
    ctx.response = encodeJsonRpcError(ctx.request.id, new RpcError(-32601, `Method '${ctx.request.method}' not found`));
  };

  const dispatcher = new MiddlewareDispatcher({
    requestGate,
    middlewareRegistry,
    middlewareEngine,
    coreDispatcher,
  });

  // Capture the actual response
  let actualResponse: unknown;
  let responseReceived = false;

  const mockRespond = async (response: unknown) => {
    actualResponse = response;
    responseReceived = true;
  };

  const transportDispatch = dispatcher.createTransportDispatch('golden-fixture');
  transportDispatch(fixture.input, mockRespond);

  // Wait for the response to be captured (with timeout)
  const timeout = 5000; // 5 seconds
  const startTime = Date.now();

  while (!responseReceived && Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
  }

  if (!responseReceived) {
    throw new Error('Timeout waiting for fixture response');
  }

  return actualResponse;
}

/**
 * Runs a fixture and updates the expected snapshot if UPDATE_SNAPSHOTS is set.
 * This enables golden fixture testing where actual output is captured as expected output.
 *
 * @param fixturePath - Path to the fixture file
 * @param snapshotName - Optional name for the snapshot (defaults to fixture filename)
 */
export async function runFixtureWithSnapshotUpdate(fixturePath: string, snapshotName?: string): Promise<void> {
  const fixture = await loadFixture(fixturePath);
  const actualSnapshotName = snapshotName || fixture.name;

  if (process.env.UPDATE_SNAPSHOTS === 'true') {
    try {
      // Execute the fixture and capture the actual MCP server response
      const actualResponse = await executeFixtureAndCaptureResponse(fixture);
      await saveSnapshot(actualSnapshotName, actualResponse);
    } catch (error) {
      throw new Error(`Failed to update snapshot for fixture: ${actualSnapshotName}. ${(error as Error).message}`);
    }
  } else {
    await runFixture(fixturePath);
  }
}

/**
 * Compares actual output to saved snapshot, unless UPDATE_SNAPSHOTS is set.
 * If set, writes new snapshot instead of asserting.
 *
 * @param name - Snapshot name
 * @param actual - Actual output to compare or save
 */
export async function expectMatchesOrUpdateSnapshot(name: string, actual: unknown): Promise<void> {
  await expectMatchesSnapshot(name, actual);
}

/**
 * Batch update all fixtures in a directory to use golden snapshots.
 * This is useful for regenerating all expected outputs after logic changes.
 *
 * @param fixtureDir - Directory containing fixture files
 * @param snapshotDir - Optional directory for snapshots (defaults to __snapshots__)
 */
export async function updateAllFixtureSnapshots(fixtureDir: string, _snapshotDir?: string): Promise<void> {
  const fixturePaths = await listFixturePaths(fixtureDir);
  const results: Array<{ name: string; success: boolean; error?: Error }> = [];

  const originalValue = process.env.UPDATE_SNAPSHOTS;
  process.env.UPDATE_SNAPSHOTS = 'true';

  try {
    for (const fixturePath of fixturePaths) {
      try {
        const fixture = await loadFixture(fixturePath);
        await runFixtureWithSnapshotUpdate(fixturePath, fixture.name);
        results.push({ name: fixture.name, success: true });
      } catch (error) {
        results.push({
          name: fixturePath,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  } finally {
    if (originalValue !== undefined) {
      process.env.UPDATE_SNAPSHOTS = originalValue;
    } else {
      delete process.env.UPDATE_SNAPSHOTS;
    }
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    const failureMessages = failures.map((f) => `${f.name}: ${f.error?.message}`).join('\n');
    throw new Error(`${failures.length} fixture snapshot update(s) failed:\n${failureMessages}`);
  }

  // In a real implementation, you might log this success
  // console.log(`✅ Updated ${results.length} fixture snapshots`);
}

export async function runFixtures(fixtureDir: string, options: FixtureRunnerOptions = {}): Promise<void> {
  const runner = new FixtureRunner(options);
  await runner.loadFixtures(fixtureDir);
  await runner.executeAll();
}

export { FixtureRunner, runFixture } from './runner';
export * from './types';
