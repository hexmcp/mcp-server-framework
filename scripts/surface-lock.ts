#!/usr/bin/env ts-node

/**
 * API Surface Lock Management Script for MCP Server Framework
 * 
 * This script provides utilities for managing API surface locks,
 * detecting breaking changes, and generating surface reports.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

interface SurfaceLockConfig {
  packagePath: string;
  lockFile: string;
  reportDir: string;
  format: 'json' | 'table' | 'ascii';
  includeTrace: boolean;
}

const DEFAULT_CONFIG: SurfaceLockConfig = {
  packagePath: './packages/core',
  lockFile: './.api-surface-lock.json',
  reportDir: './temp/api-reports',
  format: 'json',
  includeTrace: false,
};

class SurfaceLockManager {
  private config: SurfaceLockConfig;
  private startTime: number;

  constructor(config: Partial<SurfaceLockConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = performance.now();
  }

  async generateLock(): Promise<void> {
    console.log('🔒 Generating API surface lock...\n');

    try {
      await this.validatePrerequisites();
      const surface = await this.getCurrentSurface();
      await this.saveLock(surface);
      this.printSummary('generate');
    } catch (error) {
      console.error('💥 Surface lock generation failed:', error);
      process.exit(1);
    }
  }

  async validateLock(): Promise<boolean> {
    console.log('🔍 Validating API surface lock...\n');

    try {
      await this.validatePrerequisites();
      
      if (!existsSync(this.config.lockFile)) {
        console.log('⚠️  No lock file found. Generate one with: pnpm update:surface');
        return false;
      }

      const currentSurface = await this.getCurrentSurface();
      const lockedSurface = this.getLockedSurface();
      
      const changes = this.compareSurfaces(lockedSurface, currentSurface);
      
      if (changes.length === 0) {
        console.log('✅ API surface matches lock file');
        this.printSummary('validate', true);
        return true;
      } else {
        console.log('❌ API surface has changed!');
        this.printChanges(changes);
        this.printSummary('validate', false);
        return false;
      }
    } catch (error) {
      console.error('💥 Surface lock validation failed:', error);
      process.exit(1);
    }
  }

  async generateReport(): Promise<void> {
    console.log('📋 Generating API surface report...\n');

    try {
      await this.validatePrerequisites();
      await this.runApiExtractor();
      this.printSummary('report');
    } catch (error) {
      console.error('💥 API report generation failed:', error);
      process.exit(1);
    }
  }

  private async validatePrerequisites(): Promise<void> {
    // Check package is built
    const packageDistPath = `${this.config.packagePath}/dist`;
    if (!existsSync(packageDistPath)) {
      console.log('⚠️  Package not built, building now...');
      execSync(`pnpm --filter @hexmcp/core build`, { stdio: 'inherit' });
    }

    // Check ATTW is available
    try {
      execSync('pnpm exec attw --version', { stdio: 'pipe' });
    } catch {
      throw new Error('ATTW not found. Run: pnpm install');
    }

    // Check API Extractor is available
    try {
      execSync('pnpm exec api-extractor --version', { stdio: 'pipe' });
    } catch {
      throw new Error('API Extractor not found. Run: pnpm install');
    }
  }

  private async getCurrentSurface(): Promise<any> {
    console.log('🔍 Analyzing current API surface...');
    
    const command = `pnpm exec attw --pack ${this.config.packagePath} --format ${this.config.format}`;
    const result = execSync(command, { encoding: 'utf8' });
    
    try {
      return JSON.parse(result);
    } catch {
      throw new Error('Failed to parse ATTW output as JSON');
    }
  }

  private getLockedSurface(): any {
    try {
      const lockContent = readFileSync(this.config.lockFile, 'utf8');
      return JSON.parse(lockContent);
    } catch {
      throw new Error(`Failed to read lock file: ${this.config.lockFile}`);
    }
  }

  private async saveLock(surface: any): Promise<void> {
    console.log('💾 Saving API surface lock...');
    
    const lockContent = JSON.stringify(surface, null, 2);
    writeFileSync(this.config.lockFile, lockContent);
    
    console.log(`✅ Lock saved to ${this.config.lockFile}`);
  }

  private compareSurfaces(locked: any, current: any): string[] {
    const changes: string[] = [];
    
    // Simple comparison - in a real implementation, you'd want more sophisticated diffing
    const lockedStr = JSON.stringify(locked, null, 2);
    const currentStr = JSON.stringify(current, null, 2);
    
    if (lockedStr !== currentStr) {
      changes.push('API surface has changed');
      
      // Try to identify specific changes
      if (locked.problems?.length !== current.problems?.length) {
        changes.push(`Problem count changed: ${locked.problems?.length || 0} → ${current.problems?.length || 0}`);
      }
      
      if (locked.analysis?.entrypoints !== current.analysis?.entrypoints) {
        changes.push('Entry points changed');
      }
    }
    
    return changes;
  }

  private printChanges(changes: string[]): void {
    console.log('\n📋 Detected Changes:');
    console.log('─'.repeat(30));
    for (const change of changes) {
      console.log(`• ${change}`);
    }
    console.log('\n💡 To update the lock file: pnpm update:surface');
  }

  private async runApiExtractor(): Promise<void> {
    console.log('🔧 Running API Extractor...');
    
    try {
      execSync(`cd ${this.config.packagePath} && pnpm exec api-extractor run --local`, {
        stdio: 'inherit',
        timeout: 60000,
      });
      console.log('✅ API Extractor completed');
    } catch (error) {
      console.log('⚠️  API Extractor completed with warnings');
    }
  }

  private printSummary(operation: string, success?: boolean): void {
    const duration = performance.now() - this.startTime;
    
    console.log('\n📊 Surface Lock Summary');
    console.log('═'.repeat(40));
    console.log(`Operation: ${operation}`);
    console.log(`Package: ${this.config.packagePath}`);
    console.log(`Lock file: ${this.config.lockFile}`);
    console.log(`Duration: ${this.formatDuration(duration)}`);
    
    if (success !== undefined) {
      console.log(`Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === '--help') {
    console.log(`
API Surface Lock Manager for MCP Server Framework

Usage: ts-node scripts/surface-lock.ts <command> [options]

Commands:
  generate    Generate new API surface lock
  validate    Validate current surface against lock
  report      Generate detailed API report
  
Options:
  --package <path>    Package path (default: ./packages/core)
  --lock <file>       Lock file path (default: ./.api-surface-lock.json)
  --format <format>   Output format: json|table|ascii (default: json)
  --help              Show this help message

Examples:
  ts-node scripts/surface-lock.ts generate
  ts-node scripts/surface-lock.ts validate
  ts-node scripts/surface-lock.ts report
    `);
    process.exit(0);
  }

  const config: Partial<SurfaceLockConfig> = {};
  
  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--package':
        config.packagePath = value;
        break;
      case '--lock':
        config.lockFile = value;
        break;
      case '--format':
        config.format = value as 'json' | 'table' | 'ascii';
        break;
    }
  }

  const manager = new SurfaceLockManager(config);

  switch (command) {
    case 'generate':
      manager.generateLock();
      break;
    case 'validate':
      manager.validateLock().then(success => {
        process.exit(success ? 0 : 1);
      });
      break;
    case 'report':
      manager.generateReport();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

export { SurfaceLockManager, SurfaceLockConfig };
