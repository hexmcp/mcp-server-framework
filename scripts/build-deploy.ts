#!/usr/bin/env ts-node

/**
 * Build and Deployment Script for MCP Server Framework
 * 
 * This script orchestrates the complete build, documentation, and deployment
 * process for the MCP Server Framework, including quality gates and validation.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { performance } from 'perf_hooks';

interface BuildConfig {
  skipTests: boolean;
  skipDocs: boolean;
  skipSurfaceLock: boolean;
  cleanBuild: boolean;
  deployDocs: boolean;
  environment: 'development' | 'staging' | 'production';
}

const DEFAULT_CONFIG: BuildConfig = {
  skipTests: false,
  skipDocs: false,
  skipSurfaceLock: false,
  cleanBuild: true,
  deployDocs: false,
  environment: 'development',
};

class BuildDeployManager {
  private config: BuildConfig;
  private startTime: number;
  private stepResults: Array<{ step: string; success: boolean; duration: number }> = [];

  constructor(config: Partial<BuildConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = performance.now();
  }

  async execute(): Promise<void> {
    console.log('🚀 Starting MCP Server Framework Build & Deploy Process\n');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Clean build: ${this.config.cleanBuild}`);
    console.log(`Deploy docs: ${this.config.deployDocs}\n`);

    try {
      await this.runStep('Clean workspace', () => this.cleanWorkspace());
      await this.runStep('Install dependencies', () => this.installDependencies());
      await this.runStep('Lint code', () => this.lintCode());
      await this.runStep('Type check', () => this.typeCheck());
      
      if (!this.config.skipTests) {
        await this.runStep('Run tests', () => this.runTests());
      }
      
      await this.runStep('Build packages', () => this.buildPackages());
      
      if (!this.config.skipSurfaceLock) {
        await this.runStep('Validate API surface', () => this.validateSurface());
      }
      
      if (!this.config.skipDocs) {
        await this.runStep('Generate documentation', () => this.generateDocs());
      }
      
      if (this.config.deployDocs) {
        await this.runStep('Deploy documentation', () => this.deployDocs());
      }
      
      this.printSummary();
    } catch (error) {
      console.error('💥 Build process failed:', error);
      this.printSummary();
      process.exit(1);
    }
  }

  private async runStep(name: string, action: () => void | Promise<void>): Promise<void> {
    const stepStart = performance.now();
    console.log(`📋 ${name}...`);

    try {
      await action();
      const duration = performance.now() - stepStart;
      this.stepResults.push({ step: name, success: true, duration });
      console.log(`✅ ${name} completed in ${this.formatDuration(duration)}\n`);
    } catch (error) {
      const duration = performance.now() - stepStart;
      this.stepResults.push({ step: name, success: false, duration });
      console.log(`❌ ${name} failed after ${this.formatDuration(duration)}`);
      throw error;
    }
  }

  private cleanWorkspace(): void {
    if (!this.config.cleanBuild) {
      console.log('ℹ️  Skipping clean (--no-clean specified)');
      return;
    }

    console.log('🧹 Cleaning workspace...');
    
    // Clean dist directories
    execSync('find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true', { stdio: 'pipe' });
    
    // Clean documentation
    execSync('rm -rf docs/api temp 2>/dev/null || true', { stdio: 'pipe' });
    
    // Clean node_modules if requested
    if (process.env.CLEAN_MODULES === '1') {
      execSync('rm -rf node_modules packages/*/node_modules', { stdio: 'pipe' });
    }
  }

  private installDependencies(): void {
    console.log('📦 Installing dependencies...');
    execSync('pnpm install', { stdio: 'inherit' });
  }

  private lintCode(): void {
    console.log('🎨 Linting code...');
    execSync('pnpm lint', { stdio: 'inherit' });
  }

  private typeCheck(): void {
    console.log('🔍 Type checking...');
    execSync('pnpm typecheck', { stdio: 'inherit' });
    execSync('pnpm typecheck:test', { stdio: 'inherit' });
  }

  private runTests(): void {
    console.log('🧪 Running tests...');
    execSync('pnpm test', { stdio: 'inherit' });
    
    if (this.config.environment !== 'development') {
      execSync('pnpm test-fixtures', { stdio: 'inherit' });
    }
  }

  private buildPackages(): void {
    console.log('🔨 Building packages...');
    execSync('pnpm build', { stdio: 'inherit' });
  }

  private validateSurface(): void {
    console.log('🔒 Validating API surface...');
    
    try {
      execSync('pnpm check:types', { stdio: 'inherit' });
    } catch (error) {
      if (this.config.environment === 'production') {
        throw error; // Fail hard in production
      } else {
        console.log('⚠️  API surface validation failed (non-blocking in dev)');
      }
    }
  }

  private generateDocs(): void {
    console.log('📚 Generating documentation...');
    
    // Ensure docs directory exists
    if (!existsSync('docs')) {
      mkdirSync('docs', { recursive: true });
    }
    
    execSync('pnpm docs:generate', { stdio: 'inherit' });
  }

  private deployDocs(): void {
    console.log('🚀 Deploying documentation...');
    
    if (this.config.environment === 'production') {
      // In a real scenario, this would deploy to GitHub Pages, Netlify, etc.
      console.log('📤 Deploying to production documentation site...');
      // execSync('gh-pages -d docs/api', { stdio: 'inherit' });
    } else {
      console.log('ℹ️  Documentation deployment skipped (not production)');
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  private printSummary(): void {
    const totalDuration = performance.now() - this.startTime;
    const successful = this.stepResults.filter(r => r.success).length;
    const failed = this.stepResults.filter(r => !r.success).length;

    console.log('📊 Build & Deploy Summary');
    console.log('═'.repeat(50));
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Total time: ${this.formatDuration(totalDuration)}`);
    console.log(`Steps completed: ${successful}/${this.stepResults.length}`);
    console.log(`Failed steps: ${failed}\n`);

    // Print step details
    for (const result of this.stepResults) {
      const icon = result.success ? '✅' : '❌';
      const status = result.success ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.step.padEnd(25)} ${status.padEnd(6)} ${this.formatDuration(result.duration)}`);
    }

    console.log();
    
    if (failed === 0) {
      console.log('🎉 Build & deploy completed successfully!');
    } else {
      console.log('💥 Build & deploy failed! Check the errors above.');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<BuildConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--skip-tests':
        config.skipTests = true;
        break;
      case '--skip-docs':
        config.skipDocs = true;
        break;
      case '--skip-surface':
        config.skipSurfaceLock = true;
        break;
      case '--no-clean':
        config.cleanBuild = false;
        break;
      case '--deploy-docs':
        config.deployDocs = true;
        break;
      case '--env':
        config.environment = args[++i] as 'development' | 'staging' | 'production';
        break;
      case '--help':
        console.log(`
Build and Deployment Manager for MCP Server Framework

Usage: ts-node scripts/build-deploy.ts [options]

Options:
  --skip-tests      Skip running tests
  --skip-docs       Skip documentation generation
  --skip-surface    Skip API surface validation
  --no-clean        Skip cleaning workspace
  --deploy-docs     Deploy documentation after generation
  --env <env>       Environment: development|staging|production
  --help            Show this help message

Examples:
  ts-node scripts/build-deploy.ts
  ts-node scripts/build-deploy.ts --env production --deploy-docs
  ts-node scripts/build-deploy.ts --skip-tests --no-clean
        `);
        process.exit(0);
    }
  }

  const manager = new BuildDeployManager(config);
  manager.execute().catch((error) => {
    console.error('💥 Build & deploy process crashed:', error);
    process.exit(1);
  });
}

export { BuildDeployManager, BuildConfig };
