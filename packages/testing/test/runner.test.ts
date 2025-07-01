import { FixtureRunner } from '../src/runner';
import type { Fixture } from '../src/types';

// Temporary type for runner options (will be redesigned in later steps)
interface FixtureRunnerOptions {
  timeout?: number;
  verbose?: boolean;
  failFast?: boolean;
  tags?: string[];
}

describe('FixtureRunner', () => {
  let runner: FixtureRunner;

  beforeEach(() => {
    runner = new FixtureRunner();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(runner).toBeInstanceOf(FixtureRunner);
    });

    it('should accept custom options', () => {
      const options: FixtureRunnerOptions = {
        timeout: 10000,
        verbose: true,
        failFast: true,
        tags: ['integration'],
      };
      const customRunner = new FixtureRunner(options);
      expect(customRunner).toBeInstanceOf(FixtureRunner);
    });
  });

  describe('loadFixtures', () => {
    it('should handle non-existent directory', async () => {
      await expect(runner.loadFixtures('/path/to/fixtures')).rejects.toThrow('Failed to read fixture directory');
    });
  });

  describe('executeAll', () => {
    it('should return empty array when no fixtures loaded', async () => {
      const results = await runner.executeAll();
      expect(results).toEqual([]);
    });
  });

  describe('executeFixture', () => {
    it('should execute fixture and return result', async () => {
      const fixture: Fixture = {
        name: 'test-fixture',
        input: {
          jsonrpc: '2.0',
          id: 1,
          method: 'test/method',
        },
        expected: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32000,
            message: "Operational request 'test/method' requires server to be in ready state",
            data: {
              currentState: 'initializing',
              operation: 'test/method',
            },
          },
        },
      };
      const result = await runner.executeFixture(fixture);
      expect(result.fixture).toBe(fixture);
      expect(result.passed).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should detect fixture assertion failures', async () => {
      const fixture: Fixture = {
        name: 'failing-fixture',
        input: {
          jsonrpc: '2.0',
          id: 1,
          method: 'test/method',
        },
        expected: {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        },
      };
      const result = await runner.executeFixture(fixture);
      expect(result.fixture).toBe(fixture);
      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Fixture assertion failed');
    });
  });
});
