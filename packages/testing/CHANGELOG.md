# @hexmcp/testing

## 0.0.5

### Patch Changes

- Updated dependencies [0b6a880]
  - @hexmcp/core@0.8.0

## 0.0.4

### Patch Changes

- Updated dependencies [022afd2]
  - @hexmcp/core@0.7.0

## 0.0.3

### Patch Changes

- Updated dependencies [386e31b]
  - @hexmcp/core@0.6.0

## 0.0.2

### Patch Changes

- Updated dependencies [affdb0b]
  - @hexmcp/core@0.5.0

## 0.0.1

### Patch Changes

- Fix CI/CD TypeScript compilation and improve development workflow

  ## 🔧 CI/CD Infrastructure Improvements

  - **Fixed TypeScript compilation errors in CI workflows** by adding build steps before type checking
  - **Enhanced GitHub Actions workflows** with proper package building to generate required type definitions
  - **Improved release workflow reliability** with consistent build process across CI and release pipelines
  - **Optimized fixture testing integration** with sequential execution using `--runInBand` for streaming test stability

  ## 🎯 Development Workflow Enhancements

  - **Added comprehensive Git hooks integration** for fixture testing in pre-push workflow
  - **Improved quality gate process** with proper execution order: lint → typecheck → test → test-fixtures
  - **Enhanced monorepo build system** with recursive package building via `pnpm -r build`
  - **Resolved Jest module resolution conflicts** by cleaning up duplicate build artifacts

  ## 🧪 Testing Infrastructure

  - **Integrated fixture testing into CI pipeline** with dedicated test step and proper error reporting
  - **Enhanced test fixture coverage system** with 100% acceptance criteria compliance
  - **Improved streaming test reliability** with sequential execution to prevent race conditions
  - **Optimized test execution performance** with proper build dependency management

  ## 🏗️ Build System Improvements

  - **Removed lodash dependencies** and migrated to Node.js built-in `util.isDeepStrictEqual` for better performance
  - **Fixed TypeScript strict mode compliance** with proper optional property handling
  - **Enhanced workspace dependency resolution** ensuring all packages build correctly in CI environments
  - **Improved package build consistency** across development and production environments

  These changes ensure reliable CI/CD operations, improve developer experience, and maintain high code quality standards across the entire MCP Server Framework ecosystem.

- Updated dependencies
  - @hexmcp/core@0.4.1
  - @hexmcp/codec-jsonrpc@0.1.1
  - @hexmcp/transport@0.1.1
