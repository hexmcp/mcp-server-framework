# Quality Gates - MCP Server Framework

This document describes the comprehensive quality gate system implemented for the MCP Server Framework to ensure code quality, API stability, and documentation consistency.

## Overview

The quality gate system consists of multiple automated checks that run in sequence to validate different aspects of the codebase:

1. **Code Quality**: Linting and formatting
2. **Type Safety**: TypeScript compilation checks
3. **Functionality**: Unit and integration tests
4. **Build Integrity**: Package compilation
5. **API Stability**: Surface lock validation
6. **Documentation**: API documentation generation

## Quality Gate Scripts

### `pnpm quality:gate`
Runs the comprehensive quality gate using the TypeScript script with detailed progress reporting and timing.

**Features:**
- ✅ Detailed progress reporting
- ⏱️ Step timing and total duration
- 🚨 Fail-fast on required checks
- ⚠️ Optional checks that don't block
- 📊 Comprehensive summary report

### `pnpm quality:gate:simple`
Runs a simplified quality gate with basic checks only (no API surface or docs).

**Use case:** Fast feedback during development when declaration file issues exist.

### `pnpm quality:fix`
Automatically fixes linting issues and then runs the full quality gate.

## Quality Steps

### 1. Code Linting (`pnpm lint`)
- **Purpose**: Ensures code style consistency and catches common issues
- **Tool**: Biome
- **Required**: ✅ Yes
- **Timeout**: 60 seconds

**What it checks:**
- Code formatting and style
- Import/export consistency
- Unused variables and imports
- TypeScript best practices

### 2. TypeScript Compilation (`pnpm typecheck`)
- **Purpose**: Validates main source code compiles without errors
- **Required**: ✅ Yes
- **Timeout**: 2 minutes

**What it checks:**
- Type correctness
- Import resolution
- Generic constraints
- Interface compliance

### 3. Test TypeScript Compilation (`pnpm typecheck:test`)
- **Purpose**: Validates test code compiles without errors
- **Required**: ✅ Yes
- **Timeout**: 1 minute

**What it checks:**
- Test type safety
- Mock type compatibility
- Test utility types

### 4. Unit & Integration Tests (`pnpm test`)
- **Purpose**: Validates functionality and prevents regressions
- **Tool**: Jest
- **Required**: ✅ Yes
- **Timeout**: 5 minutes

**What it checks:**
- Unit test coverage
- Integration test scenarios
- Edge case handling
- Error conditions

### 5. Package Builds (`pnpm build`)
- **Purpose**: Ensures all packages compile and generate proper outputs
- **Required**: ✅ Yes
- **Timeout**: 3 minutes

**What it checks:**
- TypeScript compilation
- Declaration file generation
- Module bundling
- Export integrity

### 6. API Surface Lock Validation (`pnpm check:types`)
- **Purpose**: Prevents unintentional breaking changes to public APIs
- **Tools**: @arethetypeswrong/cli + @microsoft/api-extractor
- **Required**: ⚠️ Optional (until declaration issues resolved)
- **Timeout**: 1 minute

**What it checks:**
- Public API surface changes
- Module resolution compatibility
- Export consistency
- Breaking change detection

### 7. Documentation Generation (`pnpm docs:generate`)
- **Purpose**: Ensures API documentation can be generated successfully
- **Tool**: TypeDoc
- **Required**: ⚠️ Optional (until declaration issues resolved)
- **Timeout**: 2 minutes

**What it checks:**
- TypeDoc compilation
- Documentation completeness
- Internal API exclusion
- Markdown generation

## Integration Points

### Git Hooks

#### Pre-commit Hook
- **Trigger**: Before each commit
- **Action**: `npx lint-staged`
- **Purpose**: Ensures only properly formatted code is committed

#### Pre-push Hook
- **Trigger**: Before pushing to remote
- **Action**: `pnpm quality:gate:simple && pnpm test-fixtures`
- **Purpose**: Comprehensive validation before sharing code

### CI/CD Pipeline

#### Pull Request Validation
- **Trigger**: On PR creation/update
- **Action**: Full quality gate + API surface comparison
- **Purpose**: Prevents broken code from entering main branch

#### Main Branch Protection
- **Trigger**: On merge to main
- **Action**: Quality gate + documentation deployment + surface lock update
- **Purpose**: Maintains main branch stability and updates documentation

## Usage Examples

### Development Workflow
```bash
# Quick check during development
pnpm quality:gate:simple

# Full check before committing
pnpm quality:gate

# Fix issues and rerun
pnpm quality:fix
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Quality Gate
  run: pnpm quality:gate

- name: Check API Surface
  run: pnpm check:types
```

### Local Development
```bash
# Install dependencies
pnpm install

# Run quality gate
pnpm quality:gate

# Fix linting issues automatically
pnpm lint:fix

# Update API surface lock after intentional changes
pnpm update:surface
```

## Troubleshooting

### Common Issues

#### Linting Failures
```bash
# Fix automatically
pnpm lint:fix

# Check specific files
pnpm lint --files-max-count=10
```

#### TypeScript Errors
```bash
# Check specific package
pnpm --filter @hexmcp/core typecheck

# Rebuild declarations
pnpm --filter @hexmcp/core build
```

#### API Surface Changes
```bash
# Update surface lock after intentional changes
pnpm update:surface

# Compare current vs locked surface
pnpm check:surface
```

#### Documentation Generation
```bash
# Clean and regenerate
pnpm docs:clean && pnpm docs:generate

# Check TypeDoc configuration
npx typedoc --help
```

## Configuration Files

- **TypeDoc**: `typedoc.json`
- **API Extractor**: `packages/core/api-extractor.json`
- **Surface Lock**: `.api-surface-lock.json`
- **Quality Script**: `scripts/quality-gate.ts`
- **Git Hooks**: `.husky/pre-commit`, `.husky/pre-push`

---

*This quality gate system ensures consistent code quality and prevents regressions while maintaining fast feedback loops for developers.*
