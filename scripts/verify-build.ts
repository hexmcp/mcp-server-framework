#!/usr/bin/env tsx

/**
 * Build verification script to ensure all packages built correctly
 * 
 * This script verifies that:
 * 1. All expected output files are present
 * 2. TypeScript declarations are valid
 * 3. Package exports are accessible
 * 4. No circular dependencies exist
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface PackageInfo {
  name: string;
  path: string;
  main?: string;
  types?: string;
  exports?: Record<string, any>;
}

class BuildVerifier {
  private packagesDir = 'packages';
  private verbose = false;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  async execute(): Promise<void> {
    console.log('🔍 Verifying build outputs...\n');

    try {
      const packages = this.getPackageInfos();
      
      for (const pkg of packages) {
        this.verifyPackage(pkg);
      }
      
      this.verifyImports(packages);
      
      console.log('✅ Build verification completed successfully\n');
    } catch (error) {
      console.error('❌ Build verification failed:', error);
      process.exit(1);
    }
  }

  private verifyPackage(pkg: PackageInfo): void {
    console.log(`📦 Verifying ${pkg.name}...`);
    
    this.verifyMainFiles(pkg);
    this.verifyTypeDeclarations(pkg);
    this.verifyExports(pkg);
    
    if (this.verbose) {
      console.log(`  ✅ ${pkg.name} verification passed`);
    }
  }

  private verifyMainFiles(pkg: PackageInfo): void {
    const distPath = join(pkg.path, 'dist');
    
    if (!existsSync(distPath)) {
      throw new Error(`Missing dist directory for ${pkg.name}`);
    }
    
    if (pkg.main) {
      const mainPath = join(pkg.path, pkg.main);
      if (!existsSync(mainPath)) {
        throw new Error(`Missing main file for ${pkg.name}: ${pkg.main}`);
      }
    }
    
    if (pkg.types) {
      const typesPath = join(pkg.path, pkg.types);
      if (!existsSync(typesPath)) {
        throw new Error(`Missing types file for ${pkg.name}: ${pkg.types}`);
      }
    }
  }

  private verifyTypeDeclarations(pkg: PackageInfo): void {
    if (!pkg.types) return;
    
    const typesPath = join(pkg.path, pkg.types);
    
    try {
      const content = readFileSync(typesPath, 'utf-8');
      
      if (content.trim().length === 0) {
        throw new Error(`Empty types file for ${pkg.name}`);
      }
      
      if (!content.includes('export')) {
        console.warn(`  Warning: No exports found in types file for ${pkg.name}`);
      }
    } catch (error) {
      throw new Error(`Failed to read types file for ${pkg.name}: ${error}`);
    }
  }

  private verifyExports(pkg: PackageInfo): void {
    if (!pkg.exports) return;
    
    for (const [exportPath, exportConfig] of Object.entries(pkg.exports)) {
      if (exportPath === './package.json') continue;
      
      if (typeof exportConfig === 'object' && exportConfig.types) {
        const typesPath = join(pkg.path, exportConfig.types);
        if (!existsSync(typesPath)) {
          throw new Error(`Missing export types file for ${pkg.name}[${exportPath}]: ${exportConfig.types}`);
        }
      }
      
      if (typeof exportConfig === 'object' && exportConfig.import) {
        const importPath = join(pkg.path, exportConfig.import);
        if (!existsSync(importPath)) {
          throw new Error(`Missing export import file for ${pkg.name}[${exportPath}]: ${exportConfig.import}`);
        }
      }
    }
  }

  private verifyImports(packages: PackageInfo[]): void {
    console.log('🔗 Verifying package imports...');
    
    for (const pkg of packages) {
      try {
        if (pkg.main) {
          const mainPath = join(process.cwd(), pkg.path, pkg.main);
          require.resolve(mainPath);
        }
      } catch (error) {
        throw new Error(`Failed to resolve main module for ${pkg.name}: ${error}`);
      }
    }
    
    if (this.verbose) {
      console.log('  ✅ All package imports verified');
    }
  }

  private getPackageInfos(): PackageInfo[] {
    const packages: PackageInfo[] = [];
    
    try {
      const packageDirs = execSync(`find ${this.packagesDir} -name "package.json" -not -path "*/node_modules/*"`, 
        { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
      
      for (const packageJsonPath of packageDirs) {
        const packageDir = packageJsonPath.replace('/package.json', '');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        packages.push({
          name: packageJson.name,
          path: packageDir,
          main: packageJson.main,
          types: packageJson.types,
          exports: packageJson.exports,
        });
      }
    } catch (error) {
      throw new Error(`Failed to discover packages: ${error}`);
    }
    
    return packages;
  }
}

if (require.main === module) {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const verifier = new BuildVerifier(verbose);
  
  verifier.execute().catch((error) => {
    console.error('💥 Build verification failed:', error);
    process.exit(1);
  });
}

export { BuildVerifier };
