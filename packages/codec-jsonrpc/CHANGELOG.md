# @hexmcp/codec-jsonrpc

## 0.1.1

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

## 0.1.0

### Minor Changes

- feat(codec-jsonrpc): add debug masking and comprehensive round-trip tests

  - **Debug Masking**: Added MCPKIT_DEBUG environment variable support for stack trace masking in production environments while preserving full stack traces for debugging
  - **Round-trip Tests**: Implemented comprehensive round-trip tests that verify decode(encode(payload)) === payload identity for all JSON-RPC 2.0 message types including requests, notifications, success responses, and error responses
  - **Type Safety**: Fixed TypeScript compilation errors in test files with proper type guards for conditional properties under strict TypeScript configuration
  - **Documentation**: Updated README with debug mode usage examples and configuration instructions

  This release enhances security by masking internal stack traces in production while maintaining full debugging capabilities when needed, and ensures data integrity through comprehensive round-trip validation testing.
