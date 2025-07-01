# @hexmcp/testing

Test fixture coverage system for MCP Server Framework with comprehensive protocol validation.

## Features

- 🧪 **Fixture-Based Testing**: JSON file-based test fixtures for MCP protocol validation
- 🔧 **Test Harness Engine**: Execute fixtures through full MCP pipeline without transports
- ✅ **Protocol Validation**: Comprehensive coverage of MCP scenarios and error handling
- 📊 **Detailed Reporting**: Console and JSON reports with categorized summaries
- 🚀 **CI Integration**: Automated fixture execution via `pnpm test-fixtures` command
- 📝 **TypeScript First**: Full type safety with comprehensive interfaces

## Installation

```bash
npm install @hexmcp/testing
```

## Quick Start

```typescript
import { FixtureLoader, TestHarnessEngine } from '@hexmcp/testing';

// Load fixtures from directory
const loader = new FixtureLoader('./fixtures');
const fixtures = await loader.loadFixtures();

// Execute fixtures through test harness
const harness = new TestHarnessEngine();
const results = await harness.executeFixtures(fixtures);

console.log(`Executed ${results.length} fixtures`);
```

## CLI Usage

```bash
# Run all fixtures
pnpm test-fixtures

# Run specific category
pnpm test-fixtures --category basic

# Verbose output
pnpm test-fixtures --verbose
```

## Development Status

🚧 **Under Development** - This package is being implemented as part of the MCP Server Framework.

Current implementation status:
- [x] Package foundation and structure
- [ ] Fixture schema and validation (Task 2)
- [ ] Fixture loader implementation (Task 3)
- [ ] Test harness engine (Task 4)
- [ ] Execution context (Task 5)
- [ ] Response validation (Task 6)
- [ ] Protocol fixtures (Tasks 7-12)
- [ ] CLI integration (Task 13)
- [ ] Reporting system (Task 14)

## License

MIT
