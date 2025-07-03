#!/usr/bin/env ts-node

/**
 * Documentation Generator Script for MCP Server Framework
 * 
 * This script provides utilities for generating and managing API documentation
 * with TypeDoc, including cleanup, validation, and deployment preparation.
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

interface DocsConfig {
  outputDir: string;
  configFile: string;
  packagePath: string;
  cleanBeforeGenerate: boolean;
  validateOutput: boolean;
}

const DEFAULT_CONFIG: DocsConfig = {
  outputDir: './docs/api',
  configFile: './typedoc.json',
  packagePath: './packages/core',
  cleanBeforeGenerate: true,
  validateOutput: true,
};

class DocumentationGenerator {
  private config: DocsConfig;
  private startTime: number;

  constructor(config: Partial<DocsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = performance.now();
  }

  async generate(): Promise<void> {
    console.log('📚 Starting MCP Server Framework Documentation Generation\n');

    try {
      if (this.config.cleanBeforeGenerate) {
        await this.cleanOutput();
      }

      await this.validatePrerequisites();
      await this.generateDocs();

      if (this.config.validateOutput) {
        await this.validateOutput();
      }

      await this.generateMetadata();
      this.printSummary();
    } catch (error) {
      console.error('💥 Documentation generation failed:', error);
      process.exit(1);
    }
  }

  private async cleanOutput(): Promise<void> {
    console.log('🧹 Cleaning output directory...');
    
    if (existsSync(this.config.outputDir)) {
      rmSync(this.config.outputDir, { recursive: true, force: true });
      console.log(`✅ Cleaned ${this.config.outputDir}\n`);
    } else {
      console.log('ℹ️  Output directory doesn\'t exist, skipping cleanup\n');
    }
  }

  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 Validating prerequisites...');

    // Check TypeDoc config exists
    if (!existsSync(this.config.configFile)) {
      throw new Error(`TypeDoc config file not found: ${this.config.configFile}`);
    }

    // Check package exists and is built
    const packageDistPath = join(this.config.packagePath, 'dist');
    if (!existsSync(packageDistPath)) {
      console.log('⚠️  Package not built, building now...');
      execSync(`pnpm --filter @hexmcp/core build`, { stdio: 'inherit' });
    }

    // Check TypeDoc is available
    try {
      execSync('pnpm exec typedoc --version', { stdio: 'pipe' });
    } catch {
      throw new Error('TypeDoc not found. Run: pnpm install');
    }

    console.log('✅ Prerequisites validated\n');
  }

  private async generateDocs(): Promise<void> {
    console.log('📖 Generating TypeDoc documentation...');
    const startTime = performance.now();

    try {
      execSync(`pnpm exec typedoc --options ${this.config.configFile}`, {
        stdio: 'inherit',
        timeout: 120000, // 2 minutes
      });

      const duration = performance.now() - startTime;
      console.log(`✅ Documentation generated in ${this.formatDuration(duration)}\n`);
    } catch (error) {
      throw new Error(`TypeDoc generation failed: ${error}`);
    }
  }

  private async validateOutput(): Promise<void> {
    console.log('🔍 Validating generated documentation...');

    // Check main README exists
    const mainReadme = join(this.config.outputDir, 'README.md');
    if (!existsSync(mainReadme)) {
      throw new Error('Main documentation README.md not generated');
    }

    // Check for essential files
    const essentialFiles = [
      'modules.md',
      'classes',
      'interfaces',
      'functions',
    ];

    const missingFiles: string[] = [];
    for (const file of essentialFiles) {
      const filePath = join(this.config.outputDir, file);
      if (!existsSync(filePath) && !existsSync(`${filePath}.md`)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      console.log(`⚠️  Some expected files missing: ${missingFiles.join(', ')}`);
    }

    // Count generated files
    const fileCount = this.countFiles(this.config.outputDir);
    console.log(`✅ Documentation validated: ${fileCount} files generated\n`);
  }

  private async generateMetadata(): Promise<void> {
    console.log('📋 Generating documentation metadata...');

    const metadata = {
      generatedAt: new Date().toISOString(),
      version: this.getPackageVersion(),
      framework: 'MCP Server Framework',
      generator: 'TypeDoc',
      fileCount: this.countFiles(this.config.outputDir),
      buildDuration: this.formatDuration(performance.now() - this.startTime),
    };

    const metadataPath = join(this.config.outputDir, '.metadata.json');
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('✅ Metadata generated\n');
  }

  private getPackageVersion(): string {
    try {
      const packageJsonPath = join(this.config.packagePath, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private countFiles(dir: string): number {
    if (!existsSync(dir)) return 0;
    
    try {
      const result = execSync(`find "${dir}" -type f | wc -l`, { encoding: 'utf8' });
      return parseInt(result.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  private printSummary(): void {
    const totalDuration = performance.now() - this.startTime;
    
    console.log('📊 Documentation Generation Summary');
    console.log('═'.repeat(50));
    console.log(`Output directory: ${this.config.outputDir}`);
    console.log(`Total files: ${this.countFiles(this.config.outputDir)}`);
    console.log(`Generation time: ${this.formatDuration(totalDuration)}`);
    console.log(`Package version: ${this.getPackageVersion()}`);
    console.log('\n🎉 Documentation generation completed successfully!');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<DocsConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--output':
        config.outputDir = value;
        break;
      case '--config':
        config.configFile = value;
        break;
      case '--package':
        config.packagePath = value;
        break;
      case '--no-clean':
        config.cleanBeforeGenerate = false;
        i--; // No value for this flag
        break;
      case '--no-validate':
        config.validateOutput = false;
        i--; // No value for this flag
        break;
      case '--help':
        console.log(`
Documentation Generator for MCP Server Framework

Usage: ts-node scripts/docs-generator.ts [options]

Options:
  --output <dir>     Output directory (default: ./docs/api)
  --config <file>    TypeDoc config file (default: ./typedoc.json)
  --package <path>   Package path (default: ./packages/core)
  --no-clean        Skip cleaning output directory
  --no-validate     Skip output validation
  --help            Show this help message
        `);
        process.exit(0);
    }
  }

  const generator = new DocumentationGenerator(config);
  generator.generate().catch((error) => {
    console.error('💥 Documentation generation failed:', error);
    process.exit(1);
  });
}

export { DocumentationGenerator, DocsConfig };
