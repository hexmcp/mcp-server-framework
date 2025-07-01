import type { Fixture } from './types.js';

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

  async loadFixtures(_fixtureDir: string): Promise<void> {
    throw new Error('FixtureRunner.loadFixtures not implemented yet');
  }

  async executeAll(): Promise<FixtureTestResult[]> {
    throw new Error('FixtureRunner.executeAll not implemented yet');
  }

  async executeFixture(_fixture: Fixture): Promise<FixtureTestResult> {
    throw new Error('FixtureRunner.executeFixture not implemented yet');
  }
}
