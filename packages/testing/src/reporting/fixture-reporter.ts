import type { TestHarnessReport } from '../types/harness-types.js';

export class FixtureReporter {
  generateConsoleReport(_report: TestHarnessReport): string {
    throw new Error('Implementation coming in Task 14');
  }

  generateJsonReport(_report: TestHarnessReport): string {
    throw new Error('Implementation coming in Task 14');
  }
}
