import { encodeJsonRpcError, encodeJsonRpcSuccess, type JsonRpcResponse, RpcError } from '@hexmcp/codec-jsonrpc';
import { McpCapabilityRegistry, McpLifecycleManager, McpRequestGate, MockPrimitiveRegistry } from '../../../core/src/lifecycle/index.js';
import {
  McpMiddlewareEngine,
  McpMiddlewareRegistry,
  MiddlewareDispatcher,
  type RequestContext,
} from '../../../core/src/middleware/index.js';
import type { FixtureDefinition } from '../types/fixture-types.js';
import type { FixtureExecutionResult, TestHarnessOptions, TestHarnessReport } from '../types/harness-types.js';
import { FixtureExecutionContext } from './execution-context.js';

export interface TestHarnessEngineOptions extends TestHarnessOptions {
  enableErrorMapper?: boolean;
  middlewareTimeout?: number;
  maxMiddlewareDepth?: number;
}

export class TestHarnessEngine {
  private lifecycleManager!: McpLifecycleManager;
  private capabilityRegistry!: McpCapabilityRegistry;
  private primitiveRegistry!: MockPrimitiveRegistry;
  private requestGate!: McpRequestGate;
  private middlewareRegistry!: McpMiddlewareRegistry;
  private middlewareEngine!: McpMiddlewareEngine;
  private dispatcher!: MiddlewareDispatcher;

  constructor(private options: TestHarnessEngineOptions = {}) {
    this.setupMcpPipeline();
  }

  async executeFixture(fixture: FixtureDefinition): Promise<FixtureExecutionResult> {
    const startTime = Date.now();

    try {
      const context = new FixtureExecutionContext(fixture, {
        lifecycleManager: this.lifecycleManager,
        capabilityRegistry: this.capabilityRegistry,
        primitiveRegistry: this.primitiveRegistry,
        requestGate: this.requestGate,
        enableLogging: this.options.enableLogging ?? false,
        debugMode: this.options.debugMode ?? false,
      });

      await context.setup();

      const actualResponse = await this.executeFixtureRequest(fixture);
      const executionTime = Date.now() - startTime;

      await context.teardown();

      return {
        fixture,
        success: true,
        executionTime,
        actualResponse,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        fixture,
        success: false,
        executionTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async executeFixtures(fixtures: FixtureDefinition[]): Promise<FixtureExecutionResult[]> {
    const results: FixtureExecutionResult[] = [];

    for (const fixture of fixtures) {
      const result = await this.executeFixture(fixture);
      results.push(result);
    }

    return results;
  }

  async executeFixturesWithReport(fixtures: FixtureDefinition[]): Promise<TestHarnessReport> {
    const startTime = Date.now();
    const results = await this.executeFixtures(fixtures);
    const executionTime = Date.now() - startTime;

    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;

    const summary: TestHarnessReport['summary'] = {};
    for (const result of results) {
      const category = result.fixture.category;
      if (!summary[category]) {
        summary[category] = { total: 0, passed: 0, failed: 0 };
      }
      summary[category].total++;
      if (result.success) {
        summary[category].passed++;
      } else {
        summary[category].failed++;
      }
    }

    return {
      totalFixtures: fixtures.length,
      passed,
      failed,
      executionTime,
      results,
      summary,
    };
  }

  private setupMcpPipeline(): void {
    this.primitiveRegistry = new MockPrimitiveRegistry();
    this.capabilityRegistry = new McpCapabilityRegistry();
    this.capabilityRegistry.setPrimitiveRegistry(this.primitiveRegistry);
    this.lifecycleManager = new McpLifecycleManager(this.capabilityRegistry);
    this.requestGate = new McpRequestGate(this.lifecycleManager);
    this.middlewareRegistry = new McpMiddlewareRegistry();
    this.middlewareEngine = new McpMiddlewareEngine();

    const coreDispatcher = this.createCoreDispatcher();

    this.dispatcher = new MiddlewareDispatcher({
      requestGate: this.requestGate,
      middlewareRegistry: this.middlewareRegistry,
      middlewareEngine: this.middlewareEngine,
      coreDispatcher,
    });
  }

  private createCoreDispatcher() {
    return async (ctx: RequestContext): Promise<void> => {
      const { request } = ctx;

      try {
        let response: JsonRpcResponse;

        switch (request.method) {
          case 'ping':
            response = encodeJsonRpcSuccess(request.id, { pong: true });
            break;
          case 'prompts/list':
            response = encodeJsonRpcSuccess(request.id, { prompts: [] });
            break;
          case 'tools/list':
            response = encodeJsonRpcSuccess(request.id, { tools: [] });
            break;
          case 'resources/list':
            response = encodeJsonRpcSuccess(request.id, { resources: [] });
            break;
          default:
            response = encodeJsonRpcError(request.id, RpcError.methodNotFound(request.method));
        }

        ctx.response = response;
      } catch (error) {
        const rpcError = error instanceof RpcError ? error : RpcError.internalError();
        ctx.response = encodeJsonRpcError(request.id, rpcError);
      }
    };
  }

  private async executeFixtureRequest(fixture: FixtureDefinition): Promise<JsonRpcResponse> {
    const transportDispatch = this.dispatcher.createTransportDispatch('test-transport');

    let capturedResponse: unknown;
    const mockRespond = async (response: unknown): Promise<void> => {
      capturedResponse = response;
    };

    const metadata = {
      peer: { ip: '127.0.0.1', userAgent: 'test-harness' },
      timestamp: new Date().toISOString(),
    };

    await transportDispatch(fixture.input, mockRespond, metadata);

    if (!capturedResponse) {
      throw new Error('No response captured from fixture execution');
    }

    return capturedResponse as JsonRpcResponse;
  }

  getLifecycleManager(): McpLifecycleManager {
    return this.lifecycleManager;
  }

  getCapabilityRegistry(): McpCapabilityRegistry {
    return this.capabilityRegistry;
  }

  getPrimitiveRegistry(): MockPrimitiveRegistry {
    return this.primitiveRegistry;
  }

  getMiddlewareRegistry(): McpMiddlewareRegistry {
    return this.middlewareRegistry;
  }
}
