import type { FixtureDefinition } from './fixture-types.js';

export interface TestHarnessOptions {
  timeout?: number;
  enableLogging?: boolean;
  debugMode?: boolean;
}

export interface FixtureExecutionResult {
  fixture: FixtureDefinition;
  success: boolean;
  executionTime: number;
  actualResponse?: unknown;
  error?: Error;
  validationErrors?: string[];
}

export interface TestHarnessReport {
  totalFixtures: number;
  passed: number;
  failed: number;
  executionTime: number;
  results: FixtureExecutionResult[];
  summary: {
    [category: string]: {
      total: number;
      passed: number;
      failed: number;
    };
  };
}
