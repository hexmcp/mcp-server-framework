# MCP Server Scripts

This directory contains all the shell scripts for testing, debugging, and running the MCP note server.

## 📁 Directory Structure

```
scripts/
├── tests/          # Automated test suite
├── debug/          # Quick debugging tools
├── manual/         # Interactive testing
├── dev/            # Development utilities
└── README.md       # This file
```

## 🧪 tests/ - Automated Test Suite

**Main Test Runner:**
- `run-debug-tests.sh` - Complete automated test suite (runs all tests)

**Individual Test Scripts:**
- `test-handshake.sh` - MCP protocol handshake validation
- `test-silent-mode.sh` - Silent logging configuration testing
- `test-capabilities.sh` - Tool/resource/prompt registration testing
- `test-runtime.sh` - Functional behavior testing
- `test-shutdown.sh` - Graceful shutdown testing

**Usage:**
```bash
# Run complete test suite
cd examples/note-server
./scripts/tests/run-debug-tests.sh

# Run individual tests
./scripts/tests/test-handshake.sh
./scripts/tests/test-capabilities.sh
```

**Requirements:**
- `jq` - JSON processing
- `socat` - Socket communication
- `timeout` - Command timeouts (GNU coreutils)

## 🔍 debug/ - Quick Debugging Tools

**Scripts:**
- `quick-test.sh` - Fast 30-second verification test

**Usage:**
```bash
# Quick server verification
cd examples/note-server
./scripts/debug/quick-test.sh
```

**Purpose:**
- Rapid server functionality check
- Basic handshake validation
- Development workflow integration

## 🎮 manual/ - Interactive Testing

**Scripts:**
- `manual-test.sh` - Interactive MCP server testing with examples

**Usage:**
```bash
# Interactive testing session
cd examples/note-server
./scripts/manual/manual-test.sh
```

**Features:**
- Live JSON-RPC interaction
- Example requests provided
- Real-time server responses
- Manual workflow testing

## 🛠️ dev/ - Development Utilities

**Scripts:**
- `start-server-dev-debug.sh` - Development server with debug output

**Usage:**
```bash
# Start server with debug logging
cd examples/note-server
./scripts/dev/start-server-dev-debug.sh
```

**Purpose:**
- Development debugging
- Verbose error output
- Non-production testing

## 🚀 Quick Start

### 1. Run Complete Test Suite
```bash
cd examples/note-server
export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"  # macOS only
./scripts/tests/run-debug-tests.sh
```

### 2. Quick Verification
```bash
cd examples/note-server
./scripts/debug/quick-test.sh
```

### 3. Interactive Testing
```bash
cd examples/note-server
./scripts/manual/manual-test.sh
```

## 📊 Test Results Interpretation

### Success Indicators
- ✅ **4/5 tests passing** = Production ready
- ✅ **Handshake test passes** = MCP protocol compliance
- ✅ **Runtime test passes** = Full functionality working

### Common Issues
- **Dependencies missing**: Install `jq`, `socat`, `coreutils`
- **Server not built**: Run `pnpm build` first
- **Permission denied**: Run `chmod +x scripts/**/*.sh`

## 🔧 Maintenance

### Adding New Tests
1. Create test script in appropriate subdirectory
2. Follow naming convention: `test-{feature}.sh`
3. Make executable: `chmod +x script-name.sh`
4. Update `run-debug-tests.sh` if needed

### Script Dependencies
All scripts assume:
- Working directory: `examples/note-server/`
- Built server: `dist/note-server.js` exists
- Production script: `start-server-prod.sh` available

## 📋 Script Status

| Script | Status | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `run-debug-tests.sh` | ✅ Working | Complete test suite | jq, socat, timeout |
| `test-handshake.sh` | ✅ Working | MCP handshake | jq, timeout |
| `test-silent-mode.sh` | ✅ Working | Silent operation | jq, timeout |
| `test-capabilities.sh` | ✅ Working | Component registration | jq, socat, timeout |
| `test-runtime.sh` | ✅ Working | Full functionality | jq, timeout |
| `test-shutdown.sh` | ⚠️ Partial | Shutdown behavior | jq, timeout |
| `quick-test.sh` | ✅ Working | Fast verification | jq, timeout |
| `manual-test.sh` | ✅ Working | Interactive testing | None |
| `start-server-dev-debug.sh` | ✅ Working | Debug server | None |

## 🎯 Best Practices

1. **Always run from note-server directory**: `cd examples/note-server`
2. **Build before testing**: `pnpm build`
3. **Set PATH for macOS**: Export coreutils path for `timeout` command
4. **Clean up processes**: Scripts handle cleanup, but manual kill may be needed
5. **Check dependencies**: Ensure `jq`, `socat`, `timeout` are installed

This organized structure makes it easy to find the right script for any testing or debugging need!
