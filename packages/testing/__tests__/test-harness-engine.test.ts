import { TestHarnessEngine } from '../src/harness/test-harness-engine.js';
import { createErrorFixture, createSuccessFixture } from '../src/index.js';
import { FixtureCategory } from '../src/types/fixture-types.js';

describe('TestHarnessEngine', () => {
  let engine: TestHarnessEngine;

  beforeEach(() => {
    engine = new TestHarnessEngine({
      enableLogging: false,
      debugMode: false,
    });
  });

  describe('executeFixture', () => {
    it('should execute a successful ping fixture', async () => {
      const fixture = createSuccessFixture('test-ping', 'Test ping request', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      const result = await engine.executeFixture(fixture);

      if (!result.success) {
        console.error('Fixture execution failed:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.fixture).toBe(fixture);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-test-ping',
        result: { pong: true },
      });
      expect(result.error).toBeUndefined();
    });

    it('should execute a method not found error fixture', async () => {
      const fixture = createErrorFixture(
        'test-method-not-found',
        'Test method not found error',
        FixtureCategory.ERRORS,
        'nonexistent/method',
        {},
        -32601,
        'Method not found'
      );

      const result = await engine.executeFixture(fixture);

      expect(result.success).toBe(true);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-test-method-not-found',
        error: {
          code: -32601,
          message: 'Method not found: nonexistent/method',
        },
      });
    });

    it('should execute prompts/list fixture', async () => {
      const fixture = createSuccessFixture(
        'test-prompts-list',
        'Test prompts list',
        FixtureCategory.REGISTRIES,
        'prompts/list',
        {},
        { prompts: [] }
      );

      const result = await engine.executeFixture(fixture);

      expect(result.success).toBe(true);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-test-prompts-list',
        result: { prompts: [] },
      });
    });

    it('should execute tools/list fixture', async () => {
      const fixture = createSuccessFixture(
        'test-tools-list',
        'Test tools list',
        FixtureCategory.REGISTRIES,
        'tools/list',
        {},
        { tools: [] }
      );

      const result = await engine.executeFixture(fixture);

      expect(result.success).toBe(true);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-test-tools-list',
        result: { tools: [] },
      });
    });

    it('should execute resources/list fixture', async () => {
      const fixture = createSuccessFixture(
        'test-resources-list',
        'Test resources list',
        FixtureCategory.REGISTRIES,
        'resources/list',
        {},
        { resources: [] }
      );

      const result = await engine.executeFixture(fixture);

      expect(result.success).toBe(true);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-test-resources-list',
        result: { resources: [] },
      });
    });

    it('should handle invalid JSON-RPC requests gracefully', async () => {
      const fixture = createSuccessFixture('test-invalid', 'Test invalid fixture', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      // Simulate an error by modifying the fixture input to be completely invalid
      (fixture.input as any) = null; // This will cause a JSON-RPC parse error

      const result = await engine.executeFixture(fixture);

      // The harness should succeed in executing the fixture, but return a JSON-RPC error response
      expect(result.success).toBe(true);
      expect(result.actualResponse).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700, // Parse Error
        },
      });
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeFixtures', () => {
    it('should execute multiple fixtures', async () => {
      const fixtures = [
        createSuccessFixture('test-ping-1', 'Test ping 1', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createSuccessFixture('test-ping-2', 'Test ping 2', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createErrorFixture('test-error', 'Test error', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Method not found'),
      ];

      const results = await engine.executeFixtures(fixtures);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.executionTime >= 0)).toBe(true);
    });

    it('should handle mixed valid and invalid JSON-RPC fixtures', async () => {
      const fixtures = [
        createSuccessFixture('test-success', 'Test success', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createSuccessFixture('test-invalid', 'Test invalid', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
      ];

      // Make the second fixture have invalid JSON-RPC
      const secondFixture = fixtures[1];
      if (secondFixture) {
        (secondFixture.input as any) = null;
      }

      const results = await engine.executeFixtures(fixtures);

      expect(results).toHaveLength(2);
      const firstResult = results[0];
      const secondResult = results[1];

      if (firstResult) {
        expect(firstResult.success).toBe(true);
      }
      if (secondResult) {
        expect(secondResult.success).toBe(true); // Should succeed but return error response
        expect(secondResult.actualResponse).toMatchObject({
          jsonrpc: '2.0',
          error: { code: -32700 },
        });
      }
    });
  });

  describe('executeFixturesWithReport', () => {
    it('should generate a comprehensive report', async () => {
      const fixtures = [
        createSuccessFixture('basic-ping', 'Basic ping', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createSuccessFixture('registry-prompts', 'Registry prompts', FixtureCategory.REGISTRIES, 'prompts/list', {}, { prompts: [] }),
        createErrorFixture('error-not-found', 'Error not found', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Method not found'),
      ];

      const report = await engine.executeFixturesWithReport(fixtures);

      expect(report.totalFixtures).toBe(3);
      expect(report.passed).toBe(3);
      expect(report.failed).toBe(0);
      expect(report.executionTime).toBeGreaterThanOrEqual(0);
      expect(report.results).toHaveLength(3);

      expect(report.summary.basic).toEqual({ total: 1, passed: 1, failed: 0 });
      expect(report.summary.registries).toEqual({ total: 1, passed: 1, failed: 0 });
      expect(report.summary.errors).toEqual({ total: 1, passed: 1, failed: 0 });
    });

    it('should handle JSON-RPC errors in report', async () => {
      const fixtures = [
        createSuccessFixture('test-success', 'Test success', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createSuccessFixture('test-invalid-jsonrpc', 'Test invalid JSON-RPC', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
      ];

      // Make the second fixture have invalid JSON-RPC
      const secondFixture = fixtures[1];
      if (secondFixture) {
        (secondFixture.input as any) = null;
      }

      const report = await engine.executeFixturesWithReport(fixtures);

      expect(report.totalFixtures).toBe(2);
      expect(report.passed).toBe(2); // Both succeed in execution
      expect(report.failed).toBe(0);
      expect(report.summary.basic).toEqual({ total: 2, passed: 2, failed: 0 });
    });
  });

  describe('MCP pipeline integration', () => {
    it('should provide access to MCP components', () => {
      expect(engine.getLifecycleManager()).toBeDefined();
      expect(engine.getCapabilityRegistry()).toBeDefined();
      expect(engine.getPrimitiveRegistry()).toBeDefined();
      expect(engine.getMiddlewareRegistry()).toBeDefined();
    });

    it('should initialize lifecycle manager in ready state', () => {
      const lifecycleManager = engine.getLifecycleManager();
      expect(lifecycleManager.currentState).toBe('idle');
    });

    it('should have default capabilities', () => {
      const capabilityRegistry = engine.getCapabilityRegistry();
      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
      });
    });

    it('should have empty primitive registry by default', () => {
      const primitiveRegistry = engine.getPrimitiveRegistry();

      expect(primitiveRegistry.getPromptCount()).toBe(0);
      expect(primitiveRegistry.getToolCount()).toBe(0);
      expect(primitiveRegistry.getResourceCount()).toBe(0);
    });
  });
});
