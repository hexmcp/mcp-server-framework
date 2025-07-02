import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
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
import type { Fixture, JsonRpcChunk, JsonRpcResponse } from './types.js';

// Temporary types for runner implementation (will be redesigned in later steps)
interface FixtureRunnerOptions {
  timeout?: number;
  verbose?: boolean;
  failFast?: boolean;
  tags?: string[];
}

interface FixtureTestResult {
  fixture: Fixture;
  passed: boolean;
  error?: Error;
  actualResponse?: unknown;
  executionTime: number;
}

/**
 * Executes a single fixture test based on its file path.
 *
 * @param fixturePath - Absolute path to the fixture JSON file.
 * @returns Promise that resolves when the assertion completes.
 */
export async function runFixture(fixturePath: string): Promise<void> {
  const startTime = Date.now();

  try {
    const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
    const fixture: Fixture = JSON.parse(fixtureContent);

    if (!fixture.name || !fixture.input || !fixture.expected) {
      throw new Error(`Invalid fixture format in ${fixturePath}: missing required fields (name, input, expected)`);
    }

    const { dispatcher } = createTestExecutionContext();

    let actualResponse: unknown;
    const mockRespond = async (response: unknown) => {
      actualResponse = response;
    };

    const transportDispatch = dispatcher.createTransportDispatch('fixture-test');
    await transportDispatch(fixture.input, mockRespond);

    const normalizedActual = normalizeResponse(actualResponse);
    const normalizedExpected = normalizeExpected(fixture.expected);

    if (!isDeepStrictEqual(normalizedActual, normalizedExpected)) {
      const executionTime = Date.now() - startTime;
      throw new Error(
        `Fixture assertion failed for "${fixture.name}" (${executionTime}ms):\n` +
          `Expected: ${JSON.stringify(normalizedExpected, null, 2)}\n` +
          `Actual: ${JSON.stringify(normalizedActual, null, 2)}`
      );
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    if (error instanceof Error) {
      error.message = `${error.message} (execution time: ${executionTime}ms)`;
    }
    throw error;
  }
}

/**
 * Creates a test execution context with initialized MCP components
 */
function createTestExecutionContext() {
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
      clientInfo: { name: 'Fixture Test Client', version: '1.0.0' },
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

  return {
    dispatcher,
    lifecycleManager,
    requestGate,
    middlewareRegistry,
    middlewareEngine,
  };
}

/**
 * Normalizes a response for comparison
 */
function normalizeResponse(response: unknown): unknown {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const obj = response as Record<string, unknown>;

  // Ensure it's a valid JSON-RPC response
  if (obj.jsonrpc === '2.0' && 'id' in obj) {
    return {
      jsonrpc: obj.jsonrpc,
      id: obj.id,
      ...(obj.result !== undefined && { result: obj.result }),
      ...(obj.error !== undefined && { error: obj.error }),
    };
  }

  return response;
}

/**
 * Normalizes expected response/chunks for comparison
 */
function normalizeExpected(expected: JsonRpcResponse | JsonRpcChunk[]): unknown {
  if (Array.isArray(expected)) {
    // For streaming chunks, return as-is for now
    // TODO: Implement streaming response handling
    return expected;
  }

  return {
    jsonrpc: expected.jsonrpc,
    id: expected.id,
    ...(expected.result !== undefined && { result: expected.result }),
    ...(expected.error !== undefined && { error: expected.error }),
  };
}

export class FixtureRunner {
  private fixtures: Fixture[] = [];
  private options: FixtureRunnerOptions;

  constructor(options: FixtureRunnerOptions = {}) {
    this.options = {
      timeout: 5000,
      verbose: false,
      failFast: false,
      ...options,
    };
  }

  async loadFixtures(fixtureDir: string): Promise<void> {
    const resolvedDir = resolve(fixtureDir);

    try {
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
      const fixtureFiles: string[] = [];

      for (const entry of entries) {
        const fullPath = join(resolvedDir, entry.name);

        if (entry.isDirectory()) {
          const subRunner = new FixtureRunner(this.options);
          await subRunner.loadFixtures(fullPath);
          this.fixtures.push(...subRunner.fixtures);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          fixtureFiles.push(fullPath);
        }
      }

      for (const filePath of fixtureFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fixture: Fixture = JSON.parse(content);

          if (!fixture.name || !fixture.input || !fixture.expected) {
            continue;
          }

          this.fixtures.push(fixture);
        } catch (error) {
          if (this.options.failFast) {
            throw new Error(`Failed to load fixture ${filePath}: ${error}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to read fixture directory ${resolvedDir}: ${error}`);
    }
  }

  async executeAll(): Promise<FixtureTestResult[]> {
    const results: FixtureTestResult[] = [];

    for (const fixture of this.fixtures) {
      try {
        const result = await this.executeFixture(fixture);
        results.push(result);

        if (!result.passed && this.options.failFast) {
          break;
        }
      } catch (error) {
        const result: FixtureTestResult = {
          fixture,
          passed: false,
          error: error instanceof Error ? error : new Error(String(error)),
          executionTime: 0,
        };
        results.push(result);

        if (this.options.failFast) {
          break;
        }
      }
    }

    return results;
  }

  async executeFixture(fixture: Fixture): Promise<FixtureTestResult> {
    const startTime = Date.now();

    try {
      // Set up the MCP execution stack
      const { dispatcher } = createTestExecutionContext();

      // Capture the response
      let actualResponse: unknown;
      const mockRespond = async (response: unknown) => {
        actualResponse = response;
      };

      // Execute the request through the full MCP stack
      const transportDispatch = dispatcher.createTransportDispatch('fixture-test');
      await transportDispatch(fixture.input, mockRespond);

      // Normalize and compare actual vs expected
      const normalizedActual = normalizeResponse(actualResponse);
      const normalizedExpected = normalizeExpected(fixture.expected);

      const passed = isDeepStrictEqual(normalizedActual, normalizedExpected);
      const executionTime = Date.now() - startTime;

      return {
        fixture,
        passed,
        actualResponse: normalizedActual,
        executionTime,
        ...(!passed && {
          error: new Error(
            `Fixture assertion failed for "${fixture.name}":\n` +
              `Expected: ${JSON.stringify(normalizedExpected, null, 2)}\n` +
              `Actual: ${JSON.stringify(normalizedActual, null, 2)}`
          ),
        }),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        fixture,
        passed: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  }
}
