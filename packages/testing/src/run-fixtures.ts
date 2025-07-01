import { FixtureRunner } from './runner';

// Temporary type for runner options (will be redesigned in later steps)
interface FixtureRunnerOptions {
  timeout?: number;
  verbose?: boolean;
  failFast?: boolean;
  tags?: string[];
}

export async function runFixtures(fixtureDir: string, options: FixtureRunnerOptions = {}): Promise<void> {
  const runner = new FixtureRunner(options);
  await runner.loadFixtures(fixtureDir);
  await runner.executeAll();
}

export { FixtureRunner, runFixture } from './runner';
export * from './types';
