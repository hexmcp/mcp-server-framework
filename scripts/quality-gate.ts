#!/usr/bin/env tsx

/**
 * Quality Gate Script for MCP Server Framework
 * 
 * This script runs a comprehensive quality gate process that includes:
 * 1. Code linting and formatting
 * 2. TypeScript compilation checks
 * 3. Test execution
 * 4. API surface lock validation
 * 5. Documentation generation
 * 
 * The script provides detailed progress reporting and stops on first failure
 * for fast feedback during development.
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface QualityStep {
  name: string;
  description: string;
  command: string;
  required: boolean;
  timeout?: number;
}

const QUALITY_STEPS: QualityStep[] = [
  {
    name: 'prebuild',
    description: 'Pre-build cache cleanup and verification',
    command: 'tsx scripts/pre-build.ts',
    required: true,
    timeout: 30000,
  },
  {
    name: 'lint',
    description: 'Code linting and formatting',
    command: 'pnpm lint',
    required: true,
    timeout: 60000,
  },
  {
    name: 'typecheck',
    description: 'TypeScript compilation check',
    command: 'pnpm typecheck',
    required: true,
    timeout: 120000,
  },
  {
    name: 'typecheck:test',
    description: 'Test TypeScript compilation check',
    command: 'pnpm typecheck:test',
    required: true,
    timeout: 60000,
  },
  {
    name: 'test',
    description: 'Unit and integration tests',
    command: 'pnpm test',
    required: true,
    timeout: 300000,
  },
  {
    name: 'build',
    description: 'Package builds with enhanced verification',
    command: 'pnpm -r build',
    required: true,
    timeout: 180000,
  },
  {
    name: 'postbuild',
    description: 'Build output verification',
    command: 'tsx scripts/verify-build.ts',
    required: true,
    timeout: 30000,
  },
  {
    name: 'check:types',
    description: 'API surface lock validation',
    command: 'pnpm check:types',
    required: true,
    timeout: 60000,
  },
  {
    name: 'docs:generate',
    description: 'Documentation generation',
    command: 'pnpm docs:generate',
    required: true,
    timeout: 120000,
  },
];

class QualityGate {
  private startTime: number;
  private stepResults: Array<{ step: QualityStep; success: boolean; duration: number; error?: string }> = [];
  private simpleMode: boolean;

  constructor(simpleMode = false) {
    this.startTime = performance.now();
    this.simpleMode = simpleMode;
  }

  async run(): Promise<void> {
    const mode = this.simpleMode ? 'Simple' : 'Full';
    console.log(`🚀 Starting MCP Server Framework Quality Gate (${mode} Mode)\n`);

    const stepsToRun = this.simpleMode
      ? QUALITY_STEPS.filter(step => !['check:types', 'docs:generate'].includes(step.name))
      : QUALITY_STEPS;

    for (const step of stepsToRun) {
      await this.runStep(step);
    }

    this.printSummary();
  }

  private async runStep(step: QualityStep): Promise<void> {
    const stepStart = performance.now();
    console.log(`📋 ${step.name}: ${step.description}`);

    try {
      execSync(step.command, {
        stdio: 'pipe',
        timeout: step.timeout || 60000,
        encoding: 'utf8',
      });

      const duration = performance.now() - stepStart;
      this.stepResults.push({ step, success: true, duration });
      console.log(`✅ ${step.name} completed in ${this.formatDuration(duration)}\n`);
    } catch (error) {
      const duration = performance.now() - stepStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.stepResults.push({ step, success: false, duration, error: errorMessage });
      
      if (step.required) {
        console.log(`❌ ${step.name} failed after ${this.formatDuration(duration)}`);
        console.log(`Error: ${errorMessage}\n`);
        this.printSummary();
        process.exit(1);
      } else {
        console.log(`⚠️  ${step.name} failed (optional) after ${this.formatDuration(duration)}`);
        console.log(`Error: ${errorMessage}\n`);
      }
    }
  }

  private printSummary(): void {
    const totalDuration = performance.now() - this.startTime;
    const successful = this.stepResults.filter(r => r.success).length;
    const failed = this.stepResults.filter(r => !r.success).length;
    const requiredFailed = this.stepResults.filter(r => !r.success && r.step.required).length;

    console.log('📊 Quality Gate Summary');
    console.log('═'.repeat(50));
    console.log(`Total time: ${this.formatDuration(totalDuration)}`);
    console.log(`Steps completed: ${successful}/${this.stepResults.length}`);
    console.log(`Required failures: ${requiredFailed}`);
    console.log(`Optional failures: ${failed - requiredFailed}\n`);

    // Print step details
    for (const result of this.stepResults) {
      const icon = result.success ? '✅' : (result.step.required ? '❌' : '⚠️');
      const status = result.success ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.step.name.padEnd(20)} ${status.padEnd(6)} ${this.formatDuration(result.duration)}`);
    }

    console.log();
    
    if (requiredFailed === 0) {
      console.log('🎉 Quality gate passed! All required checks completed successfully.');
      if (failed > 0) {
        console.log(`⚠️  Note: ${failed} optional check(s) failed but did not block the gate.`);
      }
    } else {
      console.log('💥 Quality gate failed! Please fix the issues above and try again.');
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }
}

// Run the quality gate
if (require.main === module) {
  const simpleMode = process.argv.includes('--simple');
  const gate = new QualityGate(simpleMode);
  gate.run().catch((error) => {
    console.error('💥 Quality gate crashed:', error);
    process.exit(1);
  });
}

export { QualityGate };
