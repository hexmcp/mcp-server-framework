#!/usr/bin/env tsx

/**
 * Pre-build script to ensure clean builds and prevent stale cache issues
 * 
 * This script runs before the main build process to:
 * 1. Clean stale TypeScript build info files
 * 2. Verify dependency integrity
 * 3. Ensure proper build order for monorepo packages
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface BuildDependency {
  package: string;
  dependencies: string[];
}

const BUILD_ORDER: BuildDependency[] = [
  { package: 'codec-jsonrpc', dependencies: [] },
  { package: 'transport', dependencies: [] },
  { package: 'core', dependencies: ['codec-jsonrpc', 'transport'] },
  { package: 'transport-stdio', dependencies: ['transport'] },
  { package: 'testing', dependencies: ['core', 'codec-jsonrpc', 'transport'] },
];

class PreBuildManager {
  private packagesDir = 'packages';
  private verbose = false;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  async execute(): Promise<void> {
    console.log('🔧 Running pre-build checks and cleanup...\n');

    try {
      this.cleanStaleFiles();
      this.verifyPackageStructure();
      this.checkBuildDependencies();
      
      console.log('✅ Pre-build checks completed successfully\n');
    } catch (error) {
      console.error('❌ Pre-build checks failed:', error);
      process.exit(1);
    }
  }

  private cleanStaleFiles(): void {
    console.log('🧹 Cleaning stale TypeScript build files...');
    
    try {
      execSync('find . -name "*.tsbuildinfo" -delete', { stdio: this.verbose ? 'inherit' : 'pipe' });
      
      const packages = this.getPackages();
      let cleanedCount = 0;
      
      for (const pkg of packages) {
        const distPath = join(this.packagesDir, pkg, 'dist');
        if (existsSync(distPath)) {
          const stats = statSync(distPath);
          const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
          
          if (ageHours > 24) {
            if (this.verbose) {
              console.log(`  Cleaning old dist for ${pkg} (${ageHours.toFixed(1)}h old)`);
            }
            execSync(`rm -rf "${distPath}"`, { stdio: 'pipe' });
            cleanedCount++;
          }
        }
      }
      
      console.log(`  Cleaned ${cleanedCount} stale build directories`);
    } catch (error) {
      console.warn('  Warning: Some cleanup operations failed:', error);
    }
  }

  private verifyPackageStructure(): void {
    console.log('📦 Verifying package structure...');
    
    const packages = this.getPackages();
    const expectedPackages = BUILD_ORDER.map(dep => dep.package);
    
    for (const expectedPkg of expectedPackages) {
      if (!packages.includes(expectedPkg)) {
        throw new Error(`Missing expected package: ${expectedPkg}`);
      }
      
      const packageJsonPath = join(this.packagesDir, expectedPkg, 'package.json');
      if (!existsSync(packageJsonPath)) {
        throw new Error(`Missing package.json for: ${expectedPkg}`);
      }
      
      const srcPath = join(this.packagesDir, expectedPkg, 'src');
      if (!existsSync(srcPath)) {
        throw new Error(`Missing src directory for: ${expectedPkg}`);
      }
    }
    
    console.log(`  Verified ${packages.length} packages`);
  }

  private checkBuildDependencies(): void {
    console.log('🔗 Checking build dependencies...');
    
    for (const { package: pkg, dependencies } of BUILD_ORDER) {
      for (const dep of dependencies) {
        const depDistPath = join(this.packagesDir, dep, 'dist');
        if (!existsSync(depDistPath)) {
          console.log(`  Warning: Dependency ${dep} not built yet (required by ${pkg})`);
        }
      }
    }
    
    console.log('  Build dependency check completed');
  }

  private getPackages(): string[] {
    if (!existsSync(this.packagesDir)) {
      throw new Error(`Packages directory not found: ${this.packagesDir}`);
    }
    
    return readdirSync(this.packagesDir).filter(item => {
      const itemPath = join(this.packagesDir, item);
      return statSync(itemPath).isDirectory() && existsSync(join(itemPath, 'package.json'));
    });
  }
}

if (require.main === module) {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const manager = new PreBuildManager(verbose);
  
  manager.execute().catch((error) => {
    console.error('💥 Pre-build script failed:', error);
    process.exit(1);
  });
}

export { PreBuildManager };
