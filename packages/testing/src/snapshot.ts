import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

/**
 * Default directory for storing snapshots relative to the test file location.
 */
const DEFAULT_SNAPSHOTS_DIR = '__snapshots__';

/**
 * Configuration for snapshot utilities.
 */
interface SnapshotConfig {
  /** Base directory for snapshots (defaults to '__snapshots__') */
  snapshotsDir?: string;
  /** Whether to update snapshots when they don't match (defaults to false) */
  updateSnapshots?: boolean;
  /** Optional logger function for snapshot operations */
  logger?: (message: string) => void;
}

/**
 * Global snapshot configuration.
 */
let globalConfig: SnapshotConfig = {
  snapshotsDir: DEFAULT_SNAPSHOTS_DIR,
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
};

/**
 * Configure snapshot utilities globally.
 */
export function configureSnapshots(config: SnapshotConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get the full path to a snapshot file.
 */
function getSnapshotPath(name: string, baseDir?: string): string {
  const snapshotsDir = baseDir || globalConfig.snapshotsDir || DEFAULT_SNAPSHOTS_DIR;
  const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
  return resolve(join(snapshotsDir, `${sanitizedName}.json`));
}

/**
 * Saves a JSON snapshot (e.g. response or stream output) to disk under a known name.
 * Used for capturing expected output during test development or updates.
 *
 * - Ensures reproducibility across CI/dev
 * - Directory and file are created automatically if missing
 *
 * @param name - Unique name for the snapshot (will be sanitized for filesystem)
 * @param data - Object to save as JSON snapshot
 * @param baseDir - Optional base directory (defaults to global config)
 */
export async function saveSnapshot(name: string, data: unknown, baseDir?: string): Promise<void> {
  const snapshotPath = getSnapshotPath(name, baseDir);
  const snapshotDir = dirname(snapshotPath);

  try {
    // Ensure the snapshots directory exists
    await fs.mkdir(snapshotDir, { recursive: true });

    // Save the snapshot with pretty formatting
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(snapshotPath, jsonContent, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save snapshot '${name}' to ${snapshotPath}: ${error}`);
  }
}

/**
 * Loads a previously saved JSON snapshot by name.
 * Used to compare actual test results to golden snapshots.
 *
 * - Ensures consistency with versioned protocol behavior
 *
 * @param name - Name of the snapshot to load
 * @param baseDir - Optional base directory (defaults to global config)
 * @returns The loaded snapshot data
 */
export async function loadSnapshot(name: string, baseDir?: string): Promise<unknown> {
  const snapshotPath = getSnapshotPath(name, baseDir);

  try {
    const content = await fs.readFile(snapshotPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Snapshot '${name}' not found at ${snapshotPath}. Run with UPDATE_SNAPSHOTS=true to create it.`);
    }
    throw new Error(`Failed to load snapshot '${name}' from ${snapshotPath}: ${error}`);
  }
}

/**
 * Jest-aware utility that loads a named snapshot and compares it to `actual`.
 *
 * - Throws a diffing error on mismatch
 * - Can be used directly in test cases instead of `expect().toEqual()`
 * - Enables snapshot testing of full responses or chunk streams
 * - Supports automatic snapshot creation/updating when UPDATE_SNAPSHOTS=true
 *
 * @param name - Name of the snapshot to compare against
 * @param actual - Actual data to compare
 * @param baseDir - Optional base directory (defaults to global config)
 */
export async function expectMatchesSnapshot(name: string, actual: unknown, baseDir?: string): Promise<void> {
  try {
    const expected = await loadSnapshot(name, baseDir);

    if (!isDeepStrictEqual(actual, expected)) {
      const actualJson = JSON.stringify(actual, null, 2);
      const expectedJson = JSON.stringify(expected, null, 2);

      throw new Error(
        `Snapshot '${name}' does not match actual data.\n\n` +
          `Expected:\n${expectedJson}\n\n` +
          `Actual:\n${actualJson}\n\n` +
          'To update this snapshot, run with UPDATE_SNAPSHOTS=true'
      );
    }
  } catch (error) {
    if (globalConfig.updateSnapshots || (error as Error).message.includes('not found')) {
      await saveSnapshot(name, actual, baseDir);

      if (globalConfig.updateSnapshots) {
        if (globalConfig.logger) {
          globalConfig.logger(`Updated snapshot '${name}'`);
        }
        return;
      }

      if (globalConfig.logger) {
        globalConfig.logger(`Created new snapshot '${name}'`);
      }
      return;
    }

    throw error;
  }
}
