import { expectMatchesOrUpdateSnapshot, runFixtureWithSnapshotUpdate, updateAllFixtureSnapshots } from '../src/run-fixtures';
import { configureSnapshots } from '../src/snapshot';

// Example 1: Basic golden fixture testing workflow
async function exampleBasicGoldenFixture() {
  // Step 1: Configure snapshots for your test environment
  configureSnapshots({
    snapshotsDir: '__snapshots__',
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  });

  // Step 2: Run a fixture with snapshot update capability
  // This will either compare against existing snapshot or update it
  await runFixtureWithSnapshotUpdate('./fixtures/echo-tool.json');

  // Step 3: Use direct snapshot comparison for custom data
  const actualResponse = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [{ type: 'text', text: 'Hello, World!' }],
    },
  };

  // This will update snapshot if UPDATE_SNAPSHOTS=true, otherwise compare
  await expectMatchesOrUpdateSnapshot('echo-response', actualResponse);
}

// Example 2: Writing new fixtures with golden snapshots
async function exampleWritingNewFixtures() {
  // When writing new fixtures, you can capture the actual output first

  // Set UPDATE_SNAPSHOTS=true to capture actual responses
  process.env.UPDATE_SNAPSHOTS = 'true';

  configureSnapshots({
    snapshotsDir: './test-snapshots',
    updateSnapshots: true,
  });

  // Run your new fixture - this will capture whatever the MCP server actually returns
  await runFixtureWithSnapshotUpdate('./fixtures/new-feature.json', 'new-feature-snapshot');

  // The actual response is now saved as a snapshot
  // You can review it and commit it as the expected output

  // Reset for normal testing
  process.env.UPDATE_SNAPSHOTS = 'false';
}

// Example 3: Regenerating all fixtures after logic changes
async function exampleRegenerateAllFixtures() {
  // When you make changes to your MCP server logic, you might need to update
  // all expected outputs. This is dangerous but sometimes necessary.

  // biome-ignore lint/suspicious/noConsole: Example code demonstrating user warnings
  console.log('⚠️  WARNING: This will update ALL fixture snapshots!');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating user warnings
  console.log('Make sure you review the changes before committing.');

  try {
    // This temporarily sets UPDATE_SNAPSHOTS=true and processes all fixtures
    await updateAllFixtureSnapshots('./fixtures');

    // biome-ignore lint/suspicious/noConsole: Example code demonstrating success logging
    console.log('✅ All fixture snapshots updated successfully');
    // biome-ignore lint/suspicious/noConsole: Example code demonstrating success logging
    console.log('📝 Please review the changes with: git diff');
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Example code demonstrating error logging
    console.error('❌ Failed to update some fixtures:', error);
    throw error;
  }
}

// Example 4: Conditional snapshot updating based on environment
async function exampleConditionalUpdating() {
  const isCI = process.env.CI === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldUpdate = process.env.UPDATE_SNAPSHOTS === 'true';

  // Guard against accidentally updating snapshots in CI
  if (isCI && shouldUpdate) {
    throw new Error('UPDATE_SNAPSHOTS should never be true in CI environment. ' + 'This could lead to non-deterministic test results.');
  }

  // Allow snapshot updates only in development
  if (shouldUpdate && !isDevelopment) {
    // biome-ignore lint/suspicious/noConsole: Example code demonstrating warning logging
    console.warn('WARNING: Updating snapshots outside of development environment. ' + 'Make sure this is intentional.');
  }

  configureSnapshots({
    snapshotsDir: '__snapshots__',
    updateSnapshots: shouldUpdate,
  });

  // Your test logic here
  const testData = { environment: process.env.NODE_ENV, timestamp: Date.now() };
  await expectMatchesOrUpdateSnapshot('environment-test', testData);
}

// Example 5: Streaming response golden snapshots
async function exampleStreamingGoldenSnapshots() {
  // Golden snapshots work great with streaming responses too

  const streamingChunks = [
    { type: 'text', content: 'Processing request...' },
    { type: 'text', content: ' Analysis complete.' },
    { type: 'event', name: 'completion', data: { duration: 1250 } },
  ];

  // Capture or compare streaming output
  await expectMatchesOrUpdateSnapshot('streaming-analysis', streamingChunks);
}

// Example 6: Fixture validation with golden snapshots
async function exampleFixtureValidation() {
  // You can use golden snapshots to validate that your fixtures
  // are producing consistent results over time

  const fixtureResults = [];

  // Run a batch of fixtures and collect results
  const fixturePaths = ['./fixtures/basic/echo.json', './fixtures/basic/error.json', './fixtures/streaming/prompt.json'];

  for (const fixturePath of fixturePaths) {
    try {
      await runFixtureWithSnapshotUpdate(fixturePath);
      fixtureResults.push({ fixture: fixturePath, status: 'passed' });
    } catch (error) {
      fixtureResults.push({
        fixture: fixturePath,
        status: 'failed',
        error: (error as Error).message,
      });
    }
  }

  // Save the overall test results as a snapshot
  await expectMatchesOrUpdateSnapshot('fixture-validation-results', fixtureResults);
}

// Example 7: Custom snapshot naming and organization
async function exampleCustomSnapshotOrganization() {
  // You can organize snapshots by feature, version, or test suite

  const testSuite = 'tools-v2';
  const feature = 'echo-tool';

  // Use descriptive snapshot names
  const snapshotName = `${testSuite}-${feature}-success`;

  const testData = {
    version: '2.0',
    feature: 'echo',
    result: 'success',
    timestamp: '2023-01-01T00:00:00Z', // Use fixed timestamps for deterministic tests
  };

  await expectMatchesOrUpdateSnapshot(snapshotName, testData);

  // You can also use subdirectories by configuring the snapshots directory
  configureSnapshots({
    snapshotsDir: `__snapshots__/${testSuite}`,
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  });

  await expectMatchesOrUpdateSnapshot(feature, testData);
}

// Example 8: Snapshot diffing and review workflow
async function exampleSnapshotReviewWorkflow() {
  // Best practices for reviewing snapshot changes

  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('🔍 Snapshot Review Workflow:');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('1. Run tests normally first: pnpm test');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('2. If tests fail due to expected changes, update snapshots:');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('   UPDATE_SNAPSHOTS=true pnpm test');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('3. Review changes: git diff __snapshots__/');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('4. Verify changes are intentional and correct');
  // biome-ignore lint/suspicious/noConsole: Example code demonstrating workflow documentation
  console.log('5. Commit snapshot updates: git add __snapshots__/ && git commit');

  // Example of what you might see in a snapshot diff:
  // Before: { version: '1.0', features: ['basic'] }
  // After:  { version: '2.0', features: ['basic', 'advanced'] }

  const newResponse = {
    jsonrpc: '2.0' as const,
    id: 1,
    result: { version: '2.0', features: ['basic', 'advanced'] },
  };

  // This would show a diff when the snapshot is updated
  await expectMatchesOrUpdateSnapshot('version-upgrade', newResponse);
}

// Example 9: Error handling in golden fixture testing
async function exampleErrorHandling() {
  try {
    // This might fail if the fixture is invalid or the server is down
    await runFixtureWithSnapshotUpdate('./fixtures/problematic-fixture.json');
  } catch (error) {
    // You can capture error responses as snapshots too
    const errorResponse = {
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
      fixture: 'problematic-fixture',
    };

    // This helps track error patterns over time
    await expectMatchesOrUpdateSnapshot('error-patterns', errorResponse);

    // Re-throw if this was an unexpected error
    if (!(error as Error).message.includes('expected error pattern')) {
      throw error;
    }
  }
}

// Export examples for documentation and testing
export {
  exampleBasicGoldenFixture,
  exampleWritingNewFixtures,
  exampleRegenerateAllFixtures,
  exampleConditionalUpdating,
  exampleStreamingGoldenSnapshots,
  exampleFixtureValidation,
  exampleCustomSnapshotOrganization,
  exampleSnapshotReviewWorkflow,
  exampleErrorHandling,
};
