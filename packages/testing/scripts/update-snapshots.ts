#!/usr/bin/env tsx

/**
 * CLI script to update golden fixture snapshots
 *
 * Usage:
 *   pnpm tsx scripts/update-snapshots.ts [fixtures-dir] [snapshots-dir]
 *
 * Examples:
 *   pnpm tsx scripts/update-snapshots.ts ./fixtures
 *   pnpm tsx scripts/update-snapshots.ts ./fixtures ./custom-snapshots
 *   UPDATE_SNAPSHOTS=true pnpm tsx scripts/update-snapshots.ts ./fixtures
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { updateAllFixtureSnapshots } from '../src/run-fixtures';
import { configureSnapshots } from '../src/snapshot';

interface CliOptions {
  fixturesDir: string;
  snapshotsDir: string | undefined;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    fixturesDir: args[0] || './fixtures',
    snapshotsDir: args[1] || undefined,
    force: process.env.FORCE === 'true' || args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || process.env.VERBOSE === 'true',
  };

  return options;
}

async function validateDirectory(dir: string, name: string): Promise<void> {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new Error(`${name} path is not a directory: ${dir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${name} directory does not exist: ${dir}`);
    }
    throw error;
  }
}

async function countFixtures(fixturesDir: string): Promise<number> {
  try {
    const files = await fs.readdir(fixturesDir);
    return files.filter((file) => file.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function logInfo(message: string, verbose: boolean): void {
  if (verbose) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log(`ℹ️  ${message}`);
  }
}

function logWarning(message: string): void {
  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.warn(`⚠️  ${message}`);
}

function logError(message: string): void {
  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.error(`❌ ${message}`);
}

function logSuccess(message: string): void {
  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.log(`✅ ${message}`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  // Show help if requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log(`
Golden Fixture Snapshot Updater

Usage: pnpm tsx scripts/update-snapshots.ts [fixtures-dir] [snapshots-dir] [options]

Arguments:
  fixtures-dir    Directory containing fixture files (default: ./fixtures)
  snapshots-dir   Directory for snapshot files (default: __snapshots__)

Options:
  --force         Skip confirmation prompts
  --dry-run       Show what would be updated without making changes
  --verbose       Show detailed progress information
  --help, -h      Show this help message

Environment Variables:
  UPDATE_SNAPSHOTS=true   Enable snapshot updating (same as --force)
  FORCE=true             Skip confirmation prompts
  VERBOSE=true           Enable verbose logging

Examples:
  pnpm tsx scripts/update-snapshots.ts
  pnpm tsx scripts/update-snapshots.ts ./test-fixtures
  pnpm tsx scripts/update-snapshots.ts ./fixtures ./custom-snapshots --verbose
  UPDATE_SNAPSHOTS=true pnpm tsx scripts/update-snapshots.ts ./fixtures
`);
    return;
  }

  try {
    // Resolve paths
    const fixturesDir = resolve(options.fixturesDir);
    const snapshotsDir = options.snapshotsDir ? resolve(options.snapshotsDir) : undefined;

    logInfo(`Fixtures directory: ${fixturesDir}`, options.verbose);
    if (snapshotsDir) {
      logInfo(`Snapshots directory: ${snapshotsDir}`, options.verbose);
    }

    // Validate fixtures directory exists
    await validateDirectory(fixturesDir, 'Fixtures');

    // Count fixtures
    const fixtureCount = await countFixtures(fixturesDir);
    if (fixtureCount === 0) {
      logWarning(`No fixture files found in ${fixturesDir}`);
      return;
    }

    logInfo(`Found ${fixtureCount} fixture file(s)`, options.verbose);

    // Configure snapshots if custom directory specified
    if (snapshotsDir) {
      configureSnapshots({
        snapshotsDir,
        updateSnapshots: true,
      });
    }

    // Dry run mode
    if (options.dryRun) {
      logInfo('DRY RUN MODE - No changes will be made', true);
      logInfo(`Would update snapshots for ${fixtureCount} fixtures`, true);
      return;
    }

    // Confirmation prompt (unless forced)
    if (!options.force && process.env.UPDATE_SNAPSHOTS !== 'true') {
      logWarning(`This will update snapshots for ${fixtureCount} fixture(s) in ${fixturesDir}`);
      logWarning('This action will overwrite existing snapshots!');
      logWarning('Make sure you have committed any important changes first.');

      // In a real CLI, you'd use a prompt library here
      // For this example, we'll just show the warning and require explicit force
      logError('Use --force or set UPDATE_SNAPSHOTS=true to proceed');
      process.exit(1);
    }

    // Update snapshots
    logInfo('Updating fixture snapshots...', true);

    const startTime = Date.now();
    await updateAllFixtureSnapshots(fixturesDir, snapshotsDir);
    const duration = Date.now() - startTime;

    logSuccess(`Updated ${fixtureCount} fixture snapshots in ${duration}ms`);
    logInfo('Review changes with: git diff __snapshots__/', true);
    logInfo('Commit changes with: git add __snapshots__/ && git commit -m "Update fixture snapshots"', true);
  } catch (error) {
    logError(`Failed to update snapshots: ${(error as Error).message}`);
    if (options.verbose) {
      // biome-ignore lint/suspicious/noConsole: CLI script needs console output for debugging
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

export { main };
