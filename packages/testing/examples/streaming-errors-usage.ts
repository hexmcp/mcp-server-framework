import {
  createPartiallyFailingStreamHandler,
  createRandomlyFailingStreamHandler,
  createStreamErrorChunk,
  createStreamingErrorFixture,
  createStreamingTimeoutFixture,
  createStreamingValidationErrorFixture,
  isErrorChunk,
  type JsonRpcErrorChunk,
  type StreamErrorPattern,
  separateStreamErrors,
  validateStreamErrorPattern,
  withStreamTimeout,
  wrapStreamingOutput,
} from '../src';

// Example logger utility to avoid console linting issues
const logger = {
  log: (...args: unknown[]) => {
    // In a real application, this would be your actual logging implementation
    // For examples, we'll just store the messages to demonstrate the pattern
    void args; // Prevent unused variable warning
  },
  error: (...args: unknown[]) => {
    void args; // Prevent unused variable warning
  },
};

// Example 1: Basic streaming error handling
async function exampleBasicStreamingErrors() {
  // Create a handler that emits some success chunks then fails
  const successChunks = [
    { type: 'text', content: 'Processing request...' },
    { type: 'text', content: 'Analyzing data...' },
  ];

  const error = new Error('Database connection failed');
  const handler = createPartiallyFailingStreamHandler(successChunks, error);

  // Test the handler
  const chunks: unknown[] = [];
  for await (const chunk of handler({})) {
    chunks.push(chunk);
  }

  logger.log('Chunks received:', chunks.length);
  logger.log('Last chunk is error:', isErrorChunk(chunks[chunks.length - 1]));
}

// Example 2: Wrapping existing streams with error handling
async function exampleWrappingStreams() {
  // Simulate a stream that might fail
  const unreliableStream = async function* () {
    yield { type: 'text', content: 'Starting process...' };
    yield { type: 'text', content: 'Step 1 complete' };

    // Simulate a failure
    throw new Error('Network timeout during step 2');
  };

  // Wrap the stream to convert errors to structured chunks
  const safeStream = wrapStreamingOutput(unreliableStream(), {
    includeStackTrace: true,
    maxChunks: 10,
  });

  const { successChunks, errorChunks } = await separateStreamErrors(safeStream);

  logger.log('Successful chunks:', successChunks.length);
  logger.log('Error chunks:', errorChunks.length);
  logger.log('Error details:', errorChunks[0]?.message);
}

// Example 3: Timeout protection for slow streams
async function exampleTimeoutProtection() {
  // Create a slow stream
  const slowStream = async function* () {
    yield { type: 'text', content: 'Starting...' };

    // Simulate slow processing
    await new Promise((resolve) => setTimeout(resolve, 200));
    yield { type: 'text', content: 'This will timeout' };
  };

  // Wrap with timeout protection
  const timeoutProtectedStream = withStreamTimeout(slowStream(), 100); // 100ms timeout

  const chunks: unknown[] = [];
  for await (const chunk of timeoutProtectedStream) {
    chunks.push(chunk);
  }

  logger.log('Chunks before timeout:', chunks.length);
  const lastChunk = chunks[chunks.length - 1];
  if (isErrorChunk(lastChunk)) {
    logger.log('Timeout error:', lastChunk.message);
  }
}

// Example 4: Validating stream error patterns
async function exampleStreamValidation() {
  // Create a stream with a known pattern
  const predictableStream = async function* () {
    yield { type: 'text', content: 'chunk 1' };
    yield { type: 'text', content: 'chunk 2' };
    yield createStreamErrorChunk(new Error('Expected failure'));
  };

  // Define the expected pattern
  const pattern: StreamErrorPattern = {
    successCount: 2,
    errorCode: -32000,
    errorMessage: /Expected failure/,
    endsWithError: true,
  };

  // Validate the pattern
  const result = await validateStreamErrorPattern(predictableStream(), pattern);

  logger.log('Pattern validation:', result.valid ? 'PASSED' : 'FAILED');
  if (!result.valid) {
    logger.log('Validation error:', result.reason);
  }
}

// Example 5: Creating test fixtures for streaming errors
async function exampleStreamingFixtures() {
  // Create a fixture for a timeout scenario
  const timeoutFixture = createStreamingTimeoutFixture(
    'image-generation-timeout',
    'tools/call',
    { name: 'generate-image', arguments: { prompt: 'A sunset' } },
    [
      { type: 'text', content: 'Starting image generation...' },
      { type: 'event', name: 'progress', data: { percent: 25 } },
      { type: 'event', name: 'progress', data: { percent: 50 } },
    ],
    5000 // 5 second timeout
  );

  logger.log('Timeout fixture created:', timeoutFixture.name);
  if (Array.isArray(timeoutFixture.expected)) {
    logger.log('Expected chunks:', timeoutFixture.expected.length);
  }

  // Create a fixture for validation errors
  const validationFixture = createStreamingValidationErrorFixture(
    'invalid-prompt-data',
    'prompts/get',
    { name: 'analyze', arguments: { data: null } },
    [{ type: 'text', content: 'Validating input...' }],
    'Input data cannot be null',
    { receivedValue: null, expectedType: 'object' }
  );

  logger.log('Validation fixture created:', validationFixture.name);

  // Create a fixture for resource exhaustion
  const resourceFixture = createStreamingErrorFixture(
    'memory-exhaustion',
    'tools/call',
    { name: 'process-large-file', arguments: { size: '10GB' } },
    [
      { type: 'text', content: 'Loading file...' },
      { type: 'event', name: 'progress', data: { loaded: '2GB' } },
      { type: 'event', name: 'progress', data: { loaded: '4GB' } },
    ],
    createStreamErrorChunk(new Error('Out of memory'), {
      includeStackTrace: false,
    })
  );

  logger.log('Resource exhaustion fixture created:', resourceFixture.name);
}

// Example 6: Random failure testing for robustness
async function exampleRandomFailures() {
  const testData = [
    { type: 'text', content: 'Processing item 1' },
    { type: 'text', content: 'Processing item 2' },
    { type: 'text', content: 'Processing item 3' },
    { type: 'text', content: 'Processing item 4' },
    { type: 'text', content: 'Processing item 5' },
  ];

  // Create a handler that fails 30% of the time
  const randomHandler = createRandomlyFailingStreamHandler(testData, 0.3);

  // Run multiple tests to see different failure points
  for (let i = 0; i < 5; i++) {
    const chunks: unknown[] = [];
    for await (const chunk of randomHandler({})) {
      chunks.push(chunk);
    }

    const lastChunk = chunks[chunks.length - 1];
    const failed = isErrorChunk(lastChunk);

    logger.log(`Test ${i + 1}: ${chunks.length} chunks, failed: ${failed}`);
    if (failed) {
      logger.log(`  Failure at: ${(lastChunk as JsonRpcErrorChunk).message}`);
    }
  }
}

// Example 7: Complex streaming workflow with error recovery
async function exampleComplexWorkflow() {
  // Simulate a multi-stage process that can fail at various points
  const complexWorkflow = async function* () {
    try {
      // Stage 1: Initialization
      yield { type: 'event', name: 'stage', data: { stage: 1, name: 'initialization' } };
      yield { type: 'text', content: 'Initializing workflow...' };

      // Stage 2: Data processing
      yield { type: 'event', name: 'stage', data: { stage: 2, name: 'processing' } };
      yield { type: 'text', content: 'Processing data...' };

      // Simulate potential failure point
      if (Math.random() < 0.4) {
        throw new Error('Data processing failed: Invalid format detected');
      }

      // Stage 3: Finalization
      yield { type: 'event', name: 'stage', data: { stage: 3, name: 'finalization' } };
      yield { type: 'text', content: 'Finalizing results...' };

      yield { type: 'event', name: 'complete', data: { success: true } };
    } catch (error) {
      // In a real implementation, this would be handled by wrapStreamingOutput
      yield createStreamErrorChunk(error, { includeStackTrace: true });
    }
  };

  // Test the workflow with error wrapping
  const safeWorkflow = wrapStreamingOutput(complexWorkflow());

  const chunks: unknown[] = [];
  for await (const chunk of safeWorkflow) {
    chunks.push(chunk);
  }

  // Analyze the results
  const { successChunks, errorChunks } = await separateStreamErrors(
    (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })()
  );

  logger.log('Workflow completed:');
  logger.log(`  Success chunks: ${successChunks.length}`);
  logger.log(`  Error chunks: ${errorChunks.length}`);

  if (errorChunks.length > 0) {
    logger.log(`  Error: ${errorChunks[0]?.message}`);
  }
}

// Example 8: Testing streaming error fixtures
async function exampleTestingFixtures() {
  // Create a streaming error fixture
  const fixture = createStreamingTimeoutFixture(
    'slow-analysis',
    'tools/call',
    { name: 'analyze', arguments: { complexity: 'high' } },
    [
      { type: 'text', content: 'Starting analysis...' },
      { type: 'event', name: 'progress', data: { stage: 'preprocessing' } },
      { type: 'event', name: 'progress', data: { stage: 'analysis' } },
    ],
    30000 // 30 second timeout
  );

  // In a real test, you would use this fixture with your test runner
  logger.log('Test fixture for streaming timeout:');
  logger.log(`  Name: ${fixture.name}`);
  logger.log(`  Method: ${fixture.input.method}`);

  if (Array.isArray(fixture.expected)) {
    logger.log(`  Expected chunks: ${fixture.expected.length}`);

    // Verify the last chunk is an error
    const lastChunk = fixture.expected[fixture.expected.length - 1];
    if (isErrorChunk(lastChunk)) {
      logger.log(`  Timeout error: ${lastChunk.message}`);
      logger.log(`  Error code: ${lastChunk.code}`);
    }
  }
}

// Run all examples
async function runAllExamples() {
  logger.log('🔄 Streaming Error Fixtures Examples');
  logger.log('=====================================\n');

  try {
    logger.log('1. Basic streaming errors:');
    await exampleBasicStreamingErrors();
    logger.log('');

    logger.log('2. Wrapping streams:');
    await exampleWrappingStreams();
    logger.log('');

    logger.log('3. Timeout protection:');
    await exampleTimeoutProtection();
    logger.log('');

    logger.log('4. Stream validation:');
    await exampleStreamValidation();
    logger.log('');

    logger.log('5. Creating fixtures:');
    await exampleStreamingFixtures();
    logger.log('');

    logger.log('6. Random failures:');
    await exampleRandomFailures();
    logger.log('');

    logger.log('7. Complex workflow:');
    await exampleComplexWorkflow();
    logger.log('');

    logger.log('8. Testing fixtures:');
    await exampleTestingFixtures();
    logger.log('');

    logger.log('✅ All examples completed successfully!');
  } catch (error) {
    logger.error('❌ Example failed:', error);
  }
}

// Export for use in other files
export {
  exampleBasicStreamingErrors,
  exampleWrappingStreams,
  exampleTimeoutProtection,
  exampleStreamValidation,
  exampleStreamingFixtures,
  exampleRandomFailures,
  exampleComplexWorkflow,
  exampleTestingFixtures,
  runAllExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(logger.error);
}
