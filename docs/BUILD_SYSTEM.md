# Build System Documentation

## Overview

The MCP Server Framework uses an enhanced build system designed to prevent common issues like stale build caches and ensure reliable, reproducible builds across all environments.

## Quick Start

For most development scenarios, use these commands:

```bash
# Fresh, reliable build (recommended)
pnpm clean:build

# Fast development validation
pnpm quality:gate:simple

# Full validation before release
pnpm quality:gate

# Emergency clean (if issues persist)
pnpm clean && pnpm install && pnpm build
```

**Git Hooks**: The system automatically runs cache cleanup and validation when you commit and push, so you typically don't need to worry about cache issues.

## Build Process

### Enhanced Build Pipeline

The build process includes several automated steps:

1. **Pre-build Checks** (`prebuild`)
   - Cleans stale TypeScript build info files (`*.tsbuildinfo`)
   - Verifies package structure integrity
   - Checks build dependencies
   - Removes old build artifacts (>24h old)

2. **Main Build** (`build`)
   - Builds all packages in dependency order
   - Uses TypeScript project references for optimal performance

3. **Post-build Verification** (`postbuild`)
   - Verifies all expected output files are present
   - Validates TypeScript declarations
   - Checks package exports accessibility
   - Ensures no circular dependencies

### Available Commands

```bash
# Recommended workflow commands
pnpm clean:build           # Full clean and build (most reliable)
pnpm quality:gate:simple   # Fast quality gate for development
pnpm quality:gate          # Full quality gate with all checks

# Individual build steps
pnpm clean                 # Clean all build artifacts and caches
pnpm prebuild             # Run pre-build checks only
pnpm build                # Build all packages (with pre/post hooks)
pnpm postbuild            # Verify build outputs only

# Package-level commands
pnpm -r clean             # Clean all packages individually
pnpm -r build             # Build all packages without hooks

# Development commands
pnpm test-fixtures        # Run comprehensive fixture tests
pnpm typecheck           # TypeScript compilation check
pnpm lint                # Code linting and formatting
```

## Enhanced Cache Management System

### Automatic Cache Management

The build system implements a comprehensive cache management strategy to prevent stale cache issues:

#### TypeScript Build Cache (`*.tsbuildinfo`)
- **Pre-commit**: Automatically cleaned before every commit
- **Pre-push**: Full clean before comprehensive validation
- **Pre-build**: Cleaned as first step of build process
- **Manual**: `pnpm clean` removes all cache files

#### Build Output Cache (`dist/` directories)
- **Age-based cleanup**: Removes directories older than 24 hours
- **Full clean**: `pnpm clean` removes all build outputs
- **Package-level**: Individual packages clean their own outputs
- **Verification**: Post-build verification ensures outputs are valid

#### Dependency Cache Management
- **Build order verification**: Ensures dependencies are built before dependents
- **Missing dependency detection**: Warns about unbuild dependencies
- **Incremental builds**: Respects TypeScript project references for performance
- **Clean builds**: Option to force full rebuild of all packages

### Manual Cache Clearing

If you encounter build issues, try these commands in order:

```bash
# Level 1: Clean build artifacts
pnpm clean

# Level 2: Clean and rebuild
pnpm clean:build

# Level 3: Full reset (if needed)
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm clean:build
```

## Git Hooks Integration

The enhanced build system is integrated into Git hooks for automatic quality assurance:

### Pre-commit Hook
- **Trigger**: Before each commit
- **Actions**:
  - Cleans stale TypeScript cache files (`*.tsbuildinfo`)
  - Runs lint-staged on changed files
- **Purpose**: Fast feedback with automatic cache cleanup
- **Performance**: ~1-2 seconds additional overhead

### Pre-push Hook
- **Trigger**: Before pushing to remote
- **Actions**:
  - Full workspace clean (`pnpm clean`)
  - Comprehensive quality gate (simple mode)
  - Fixture tests execution
  - Build output verification
- **Purpose**: Comprehensive validation before sharing code
- **Performance**: ~10-15 seconds for complete validation

## CI/CD Integration

The enhanced build system is integrated into all CI/CD workflows:

- **GitHub Actions**: Automatically runs clean before build
- **Git Hooks**: Prevent stale cache issues at commit/push time
- **Release Process**: Includes full verification with cache management

## Troubleshooting

### Common Issues

1. **"Cannot find module '@hexmcp/core'"**
   - **Cause**: Stale build cache or incomplete build
   - **Solution**: `pnpm clean:build`
   - **Prevention**: Now automatically prevented by Git hooks

2. **"TypeScript compilation errors"**
   - **Cause**: Inconsistent build state or stale `*.tsbuildinfo` files
   - **Solution**: `pnpm clean && pnpm build`
   - **Prevention**: Pre-build script automatically cleans cache

3. **"Build verification failed"**
   - **Cause**: Missing or corrupted output files
   - **Solution**: Check the verification output and rebuild affected packages
   - **Prevention**: Post-build verification catches issues immediately

4. **"Git hooks taking too long"**
   - **Cause**: Full quality gate in pre-push hook
   - **Solution**: Use `git push --no-verify` for emergency pushes (not recommended)
   - **Alternative**: Run `pnpm quality:gate:simple` locally first

5. **"Pre-commit hook fails"**
   - **Cause**: Linting errors or cache cleanup issues
   - **Solution**: Run `pnpm lint:fix` and try again
   - **Debug**: Check `.husky/pre-commit` for specific error

### Debug Mode

Run build scripts with verbose output:

```bash
# Verbose pre-build checks
tsx scripts/pre-build.ts --verbose

# Verbose build verification
tsx scripts/verify-build.ts --verbose

# Quality gate with detailed output
pnpm quality:gate

# Test Git hooks manually
.husky/pre-commit   # Test pre-commit hook
.husky/pre-push     # Test pre-push hook
```

## Package Dependencies

The build system respects the following dependency order:

1. `codec-jsonrpc` (no dependencies)
2. `transport` (no dependencies)
3. `core` (depends on: codec-jsonrpc, transport)
4. `transport-stdio` (depends on: transport)
5. `testing` (depends on: core, codec-jsonrpc, transport)

## Enhanced Build Scripts

### Pre-build Script (`scripts/pre-build.ts`)
**Purpose**: Ensures clean build environment and validates package structure

**Features**:
- Cleans stale TypeScript build info files (`*.tsbuildinfo`)
- Removes old build directories (>24 hours old)
- Verifies package structure integrity
- Checks build dependency order
- Provides verbose mode for debugging

**Usage**:
```bash
tsx scripts/pre-build.ts           # Standard mode
tsx scripts/pre-build.ts --verbose # Detailed output
```

### Build Verification Script (`scripts/verify-build.ts`)
**Purpose**: Validates build outputs and package integrity

**Features**:
- Verifies all expected output files are present
- Validates TypeScript declaration files
- Checks package exports accessibility
- Ensures no missing dependencies
- Provides detailed error reporting

**Usage**:
```bash
tsx scripts/verify-build.ts           # Standard mode
tsx scripts/verify-build.ts --verbose # Detailed output
```

### Enhanced Quality Gate (`scripts/quality-gate.ts`)
**Purpose**: Comprehensive quality validation with cache management

**Features**:
- Integrated pre-build cache cleanup
- Post-build verification
- Simple mode for faster development
- Detailed progress reporting and timing
- Fail-fast on required checks

**Usage**:
```bash
tsx scripts/quality-gate.ts          # Full quality gate
tsx scripts/quality-gate.ts --simple # Simple mode (faster)
```

## Best Practices

1. **Always use `pnpm clean:build` for fresh builds**
   - Most reliable way to ensure clean state
   - Automatically runs pre-build cleanup and post-build verification

2. **Trust the Git hooks for quality assurance**
   - Pre-commit: Handles cache cleanup and linting automatically
   - Pre-push: Runs comprehensive validation before sharing code

3. **Use appropriate commands for different scenarios**
   - Development: `pnpm quality:gate:simple` for fast feedback
   - Release: `pnpm quality:gate` for full validation
   - Debugging: Add `--verbose` flags for detailed output

4. **Monitor build performance**
   - Check CI logs for build warnings and timing
   - Use quality gate summary for performance insights

5. **Handle cache issues proactively**
   - Git hooks prevent most cache issues automatically
   - Use `pnpm clean:build` if you encounter any build problems

6. **Keep dependencies up to date**
   - Regularly update TypeScript, build tools, and dependencies
   - Test build system after major dependency updates

## Scripts Reference

| Script | Purpose | When to Use | Performance |
|--------|---------|-------------|-------------|
| `prebuild` | Pre-build checks and cleanup | Automatically before build | ~1s |
| `build` | Main build process with hooks | Standard builds | ~10s |
| `postbuild` | Build verification | Automatically after build | ~1s |
| `clean` | Remove all build artifacts | Before fresh builds | ~1s |
| `clean:build` | Clean and build in one step | Recommended for reliability | ~12s |
| `quality:gate` | Full quality validation | Before releases | ~15s |
| `quality:gate:simple` | Fast quality validation | Development workflow | ~10s |
| `test-fixtures` | Comprehensive fixture tests | Integration testing | ~5s |

## Git Hooks Reference

| Hook | Trigger | Actions | Performance | Can Skip |
|------|---------|---------|-------------|----------|
| `pre-commit` | Before commit | Cache cleanup + lint-staged | ~2s | `git commit --no-verify` |
| `pre-push` | Before push | Full clean + quality gate + fixtures | ~15s | `git push --no-verify` |

## Monitoring and Feedback

The build system provides comprehensive feedback and monitoring:

### Build Process Indicators
- ✅ Success indicators for each step
- ⚠️ Warnings for potential issues (non-blocking)
- ❌ Clear error messages with actionable solutions
- 📊 Build timing and performance statistics
- 🔍 Detailed progress reporting in quality gate

### Git Hook Feedback
- 🧹 Cache cleanup notifications
- 🎨 Lint-staged progress indicators
- 🚀 Quality gate step-by-step progress
- 🎯 Fixture test execution status
- 📋 Build verification results

### Performance Monitoring
- **Pre-commit**: ~1-2 seconds (cache cleanup + linting)
- **Pre-push**: ~10-15 seconds (full validation)
- **Quality gate**: Detailed timing for each step
- **Build verification**: Package-by-package validation status

### Troubleshooting Support
- Verbose modes available for all scripts
- Clear error categorization (cache, build, verification)
- Suggested solutions for common issues
- Debug commands for manual testing

This comprehensive monitoring ensures you always know the state of your build and can quickly identify and resolve any issues before they impact the team.
