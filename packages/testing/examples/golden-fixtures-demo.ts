#!/usr/bin/env tsx

/**
 * Complete demonstration of the Golden Fixture Flag functionality
 *
 * This script shows how to use the UPDATE_SNAPSHOTS=true flag to:
 * 1. Capture actual MCP server responses as golden snapshots
 * 2. Update existing snapshots after logic changes
 * 3. Validate fixture outputs against captured snapshots
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { expectMatchesOrUpdateSnapshot, runFixtureWithSnapshotUpdate, updateAllFixtureSnapshots } from '../src/run-fixtures';
import { configureSnapshots } from '../src/snapshot';

// Demo configuration
const DEMO_DIR = './demo-golden-fixtures';
const SNAPSHOTS_DIR = './demo-snapshots';

async function setupDemo(): Promise<void> {
  // Clean up any existing demo files
  await fs.rm(DEMO_DIR, { recursive: true, force: true });
  await fs.rm(SNAPSHOTS_DIR, { recursive: true, force: true });

  // Create demo directories
  await fs.mkdir(DEMO_DIR, { recursive: true });
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });

  // Configure snapshots for demo
  configureSnapshots({
    snapshotsDir: SNAPSHOTS_DIR,
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  });

  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('🚀 Golden Fixture Demo Setup Complete');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log(`📁 Fixtures: ${DEMO_DIR}`);
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log(`📸 Snapshots: ${SNAPSHOTS_DIR}`);
}

async function createSampleFixtures(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('\n📝 Creating sample fixtures...');

  const fixtures = [
    {
      name: 'echo-tool-success',
      input: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: { message: 'Hello, World!' },
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
    },
    {
      name: 'list-tools',
      input: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
      expected: {
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32000,
          message: "Operational request 'tools/list' requires server to be in ready state",
          data: {
            currentState: 'initializing',
            operation: 'tools/list',
          },
        },
      },
    },
    {
      name: 'invalid-method',
      input: {
        jsonrpc: '2.0',
        id: 3,
        method: 'nonexistent/method',
        params: {},
      },
      expected: {
        jsonrpc: '2.0',
        id: 3,
        error: {
          code: -32601,
          message: "Method 'nonexistent/method' not found",
        },
      },
    },
  ];

  for (const fixture of fixtures) {
    const fixturePath = join(DEMO_DIR, `${fixture.name}.json`);
    await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2));
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log(`  ✅ Created ${fixture.name}.json`);
  }
}

async function demonstrateGoldenFixtures(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('\n🎯 Demonstrating Golden Fixture Functionality...');

  if (process.env.UPDATE_SNAPSHOTS === 'true') {
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('\n📸 UPDATE_SNAPSHOTS=true - Capturing actual responses as snapshots');

    // Update all fixtures to capture actual responses
    await updateAllFixtureSnapshots(DEMO_DIR);

    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('✅ All fixture snapshots updated!');

    // Show what snapshots were created
    const snapshotFiles = await fs.readdir(SNAPSHOTS_DIR);
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('\n📸 Created snapshots:');
    for (const file of snapshotFiles) {
      // biome-ignore lint/suspicious/noConsole: Demo script needs console output
      console.log(`  📄 ${file}`);
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('\n🔍 Normal mode - Comparing against existing snapshots');

    // Run individual fixture with snapshot comparison
    const fixturePath = join(DEMO_DIR, 'echo-tool-success.json');
    try {
      await runFixtureWithSnapshotUpdate(fixturePath);
      // biome-ignore lint/suspicious/noConsole: Demo script needs console output
      console.log('✅ Fixture matches snapshot');
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Demo script needs console output
      console.log(`❌ Fixture mismatch: ${(error as Error).message}`);
    }
  }
}

async function demonstrateCustomSnapshots(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('\n🎨 Demonstrating custom snapshot testing...');

  // Test custom data with snapshots
  const customData = {
    timestamp: '2023-01-01T00:00:00Z', // Fixed timestamp for deterministic tests
    version: '1.0.0',
    features: ['golden-fixtures', 'streaming', 'validation'],
    metadata: {
      environment: 'demo',
      testMode: true,
    },
  };

  await expectMatchesOrUpdateSnapshot('custom-demo-data', customData);
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('✅ Custom data snapshot handled');

  // Test streaming-like data
  const streamingData = [
    { type: 'text', content: 'Processing request...' },
    { type: 'text', content: ' Analysis complete.' },
    { type: 'event', name: 'completion', data: { duration: 1250 } },
  ];

  await expectMatchesOrUpdateSnapshot('streaming-demo', streamingData);
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('✅ Streaming data snapshot handled');
}

async function showWorkflowInstructions(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('\n📋 Golden Fixture Workflow:');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('1. 🆕 Writing new tests:');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('   UPDATE_SNAPSHOTS=true pnpm tsx examples/golden-fixtures-demo.ts');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('2. 🔍 Running normal tests:');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('   pnpm tsx examples/golden-fixtures-demo.ts');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('3. 📝 Review changes:');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('   git diff demo-snapshots/');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('4. 💾 Commit snapshots:');
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('   git add demo-snapshots/ && git commit -m "Update golden snapshots"');
}

async function cleanup(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('\n🧹 Cleaning up demo files...');
  await fs.rm(DEMO_DIR, { recursive: true, force: true });
  await fs.rm(SNAPSHOTS_DIR, { recursive: true, force: true });
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.log('✅ Cleanup complete');
}

async function main(): Promise<void> {
  try {
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('🌟 Golden Fixture Flag Demonstration');
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('=====================================');

    await setupDemo();
    await createSampleFixtures();
    await demonstrateGoldenFixtures();
    await demonstrateCustomSnapshots();
    await showWorkflowInstructions();

    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.log('\n🎉 Demo completed successfully!');

    if (process.env.KEEP_DEMO_FILES !== 'true') {
      await cleanup();
    } else {
      // biome-ignore lint/suspicious/noConsole: Demo script needs console output
      console.log('\n📁 Demo files preserved (KEEP_DEMO_FILES=true)');
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: Demo script needs console output
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { main };
