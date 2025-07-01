import { configureSnapshots, createToolRequest, expectMatchesSnapshot, loadSnapshot, runFixture, saveSnapshot } from '../src';

// Example 1: Basic snapshot testing in a Jest test
async function exampleBasicSnapshotTest() {
  // Configure snapshots for this test suite
  configureSnapshots({
    snapshotsDir: '__snapshots__',
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  });

  // Some test data (could be from an actual MCP server response)
  const actualResponse = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [
        { type: 'text', text: 'Hello, World!' },
        { type: 'metadata', timestamp: '2023-01-01T00:00:00Z' },
      ],
    },
  };

  // Compare against saved snapshot
  await expectMatchesSnapshot('tool-echo-response', actualResponse);
}

// Example 2: Capturing streaming responses
async function exampleStreamingSnapshot() {
  const streamingChunks = [
    { type: 'text', content: 'The weather today is ' },
    { type: 'text', content: 'sunny with a temperature of ' },
    { type: 'text', content: '75°F.' },
    { type: 'event', name: 'completion', data: { wordCount: 9 } },
  ];

  // Save the streaming response as a snapshot
  await saveSnapshot('weather-streaming-response', streamingChunks);

  // Later, in a test, compare actual streaming output
  await expectMatchesSnapshot('weather-streaming-response', streamingChunks);
}

// Example 3: Golden snapshot testing with fixture execution
async function exampleFixtureSnapshotTesting() {
  // In this example, we execute a fixture and capture the actual response as a snapshot
  // rather than pre-defining the expected response

  // Execute the fixture and capture the actual response
  try {
    await runFixture('./temp-fixture.json');
  } catch (_error) {
    // Capture the actual response for snapshot comparison
    const actualResponse = {
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
    };

    // Compare against golden snapshot
    await expectMatchesSnapshot('echo-tool-lifecycle-error', actualResponse);
  }
}

// Example 4: Regression testing with snapshots
async function exampleRegressionTesting() {
  // Simulate running multiple test scenarios and capturing their outputs
  const testScenarios = [
    {
      name: 'valid-tool-call',
      input: createToolRequest('echo', { message: 'Hello' }),
    },
    {
      name: 'invalid-tool-params',
      input: createToolRequest('echo', {}),
    },
    {
      name: 'unknown-tool',
      input: createToolRequest('nonexistent', { param: 'value' }),
    },
  ];

  for (const scenario of testScenarios) {
    // Simulate executing the scenario (in real tests, this would call the actual MCP server)
    const mockResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32000,
        message: `Operational request 'tools/call' requires server to be in ready state`,
        data: {
          currentState: 'initializing',
          operation: 'tools/call',
        },
      },
    };

    // Compare against snapshot for regression detection
    await expectMatchesSnapshot(`regression-${scenario.name}`, mockResponse);
  }
}

// Example 5: Updating snapshots during development
async function exampleSnapshotUpdating() {
  // During development, you might want to update snapshots when the expected output changes
  configureSnapshots({
    updateSnapshots: true, // This would typically be controlled by environment variable
  });

  const newExpectedOutput = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [
        { type: 'text', text: 'Updated response format' },
        { type: 'version', version: '2.0' }, // New field added
      ],
    },
  };

  // This will update the snapshot instead of failing
  await expectMatchesSnapshot('updated-response-format', newExpectedOutput);
}

// Example 6: Loading snapshots for manual comparison
async function exampleManualSnapshotComparison() {
  // Load a snapshot for manual inspection or custom comparison logic
  const expectedResponse = await loadSnapshot('complex-response-snapshot');

  // Perform custom validation logic
  if (typeof expectedResponse === 'object' && expectedResponse !== null) {
    const response = expectedResponse as Record<string, unknown>;
    // In a real scenario, you might log this for debugging
    // console.log('Expected response structure:', Object.keys(response));

    // Custom assertions based on the snapshot data
    if (response.jsonrpc !== '2.0') {
      throw new Error('Expected JSON-RPC 2.0 format');
    }
  }
}

// Example 7: Snapshot testing with different environments
async function exampleEnvironmentSpecificSnapshots() {
  const environment = process.env.NODE_ENV || 'development';

  // Use environment-specific snapshot directories
  configureSnapshots({
    snapshotsDir: `__snapshots__/${environment}`,
  });

  const environmentSpecificResponse = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      environment,
      features: environment === 'production' ? ['basic'] : ['basic', 'debug'],
    },
  };

  await expectMatchesSnapshot('environment-response', environmentSpecificResponse);
}

// Export examples for documentation and testing
export {
  exampleBasicSnapshotTest,
  exampleStreamingSnapshot,
  exampleFixtureSnapshotTesting,
  exampleRegressionTesting,
  exampleSnapshotUpdating,
  exampleManualSnapshotComparison,
  exampleEnvironmentSpecificSnapshots,
};
