# @hexmcp/codec-jsonrpc

## 0.1.0

### Minor Changes

- feat(codec-jsonrpc): add debug masking and comprehensive round-trip tests

  - **Debug Masking**: Added MCPKIT_DEBUG environment variable support for stack trace masking in production environments while preserving full stack traces for debugging
  - **Round-trip Tests**: Implemented comprehensive round-trip tests that verify decode(encode(payload)) === payload identity for all JSON-RPC 2.0 message types including requests, notifications, success responses, and error responses
  - **Type Safety**: Fixed TypeScript compilation errors in test files with proper type guards for conditional properties under strict TypeScript configuration
  - **Documentation**: Updated README with debug mode usage examples and configuration instructions

  This release enhances security by masking internal stack traces in production while maintaining full debugging capabilities when needed, and ensures data integrity through comprehensive round-trip validation testing.
