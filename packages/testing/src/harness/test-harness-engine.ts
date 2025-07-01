import type { FixtureDefinition } from '../types/fixture-types.js';
import type { FixtureExecutionResult } from '../types/harness-types.js';

export class TestHarnessEngine {
  async executeFixture(_fixture: FixtureDefinition): Promise<FixtureExecutionResult> {
    throw new Error('Implementation coming in Task 4');
  }

  async executeFixtures(_fixtures: FixtureDefinition[]): Promise<FixtureExecutionResult[]> {
    throw new Error('Implementation coming in Task 4');
  }
}
