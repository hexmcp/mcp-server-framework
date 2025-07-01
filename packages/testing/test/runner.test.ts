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
    it('should throw not implemented error', async () => {
      await expect(runner.loadFixtures('/path/to/fixtures')).rejects.toThrow('FixtureRunner.loadFixtures not implemented yet');
    });
  });

  describe('executeAll', () => {
    it('should throw not implemented error', async () => {
      await expect(runner.executeAll()).rejects.toThrow('FixtureRunner.executeAll not implemented yet');
    });
  });

  describe('executeFixture', () => {
    it('should throw not implemented error', async () => {
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
          result: { success: true },
        },
      };
      await expect(runner.executeFixture(fixture)).rejects.toThrow('FixtureRunner.executeFixture not implemented yet');
    });
  });
});
