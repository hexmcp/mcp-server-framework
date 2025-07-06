#!/bin/bash

echo "🔍 MCP Server Production Debug Test Suite"
echo "=========================================="
echo ""

cd "$(dirname "$0")/../.."

SCRIPT_DIR="$(pwd)"
TOTAL_TESTS=5
PASSED_TESTS=0
FAILED_TESTS=0

check_dependencies() {
    echo "🔧 Checking dependencies..."
    
    local missing_deps=0
    
    if ! command -v jq >/dev/null 2>&1; then
        echo "❌ Error: jq is required but not installed"
        echo "   Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        missing_deps=$((missing_deps + 1))
    fi
    
    if ! command -v socat >/dev/null 2>&1; then
        echo "❌ Error: socat is required but not installed"
        echo "   Install with: brew install socat (macOS) or apt-get install socat (Ubuntu)"
        missing_deps=$((missing_deps + 1))
    fi
    
    if ! command -v timeout >/dev/null 2>&1; then
        echo "❌ Error: timeout is required but not installed"
        echo "   Install with: brew install coreutils (macOS) or apt-get install coreutils (Ubuntu)"
        missing_deps=$((missing_deps + 1))
    fi
    
    if [ $missing_deps -gt 0 ]; then
        echo ""
        echo "❌ Missing $missing_deps required dependencies. Please install them and try again."
        exit 1
    fi
    
    echo "✅ All dependencies are available"
    echo ""
}

check_build() {
    echo "📦 Checking build status..."
    
    if [ ! -f "dist/note-server.js" ]; then
        echo "⚠️  dist/note-server.js not found. Building..."
        
        if ! pnpm build; then
            echo "❌ Error: Build failed"
            exit 1
        fi
        
        echo "✅ Build completed"
    else
        echo "✅ Build artifacts found"
    fi
    echo ""
}

make_executable() {
    echo "🔧 Making test scripts executable..."

    chmod +x scripts/tests/test-handshake.sh
    chmod +x scripts/tests/test-silent-mode.sh
    chmod +x scripts/tests/test-capabilities.sh
    chmod +x scripts/tests/test-runtime.sh
    chmod +x scripts/tests/test-shutdown.sh
    chmod +x start-server-prod.sh

    echo "✅ Test scripts are executable"
    echo ""
}

run_test() {
    local test_name="$1"
    local test_script="$2"
    local test_number="$3"
    
    echo "🧪 Test $test_number/$TOTAL_TESTS: $test_name"
    echo "----------------------------------------"
    
    if [ ! -f "$test_script" ]; then
        echo "❌ Error: Test script $test_script not found"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    local start_time=$(date +%s)
    
    if ./"$test_script"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo "✅ $test_name PASSED (${duration}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo ""
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo "❌ $test_name FAILED (${duration}s)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo ""
        return 1
    fi
}

cleanup_processes() {
    echo "🧹 Cleaning up any remaining processes..."
    
    pkill -f "note-server.js" 2>/dev/null || true
    pkill -f "start-server-prod.sh" 2>/dev/null || true
    
    sleep 1
    
    local remaining=$(pgrep -f "note-server" | wc -l)
    if [ "$remaining" -gt 0 ]; then
        echo "⚠️  Warning: $remaining note-server processes still running"
        echo "   You may need to manually kill them: pkill -f note-server"
    else
        echo "✅ All processes cleaned up"
    fi
    echo ""
}

print_summary() {
    echo "📊 Test Results Summary"
    echo "======================"
    echo ""
    echo "Total tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 ALL TESTS PASSED!"
        echo ""
        echo "✅ Your MCP server is ready for Cursor integration"
        echo "🔗 Add this to your Cursor MCP settings:"
        echo ""
        echo "{"
        echo "  \"mcpServers\": {"
        echo "    \"note-server\": {"
        echo "      \"command\": \"$SCRIPT_DIR/start-server-prod.sh\""
        echo "    }"
        echo "  }"
        echo "}"
        echo ""
    else
        echo "❌ $FAILED_TESTS test(s) failed"
        echo ""
        echo "💡 Common issues and solutions:"
        echo "   - Handshake failures: Check for console.log or stderr output"
        echo "   - Silent mode issues: Verify environment variables and logging config"
        echo "   - Capability failures: Check tool/resource/prompt registration"
        echo "   - Runtime failures: Test individual components manually"
        echo "   - Shutdown failures: Check signal handling in note-server.ts"
        echo ""
        echo "📋 Review the debug plan for detailed troubleshooting:"
        echo "   cat debug-plan.md"
        echo ""
        return 1
    fi
}

main() {
    echo "Starting debug test suite at $(date)"
    echo ""
    
    check_dependencies
    check_build
    make_executable
    
    echo "🚀 Running debug tests..."
    echo ""
    
    run_test "MCP Handshake Protocol" "scripts/tests/test-handshake.sh" 1
    run_test "Silent Mode Configuration" "scripts/tests/test-silent-mode.sh" 2
    run_test "Capabilities Registration" "scripts/tests/test-capabilities.sh" 3
    run_test "Runtime Behavior" "scripts/tests/test-runtime.sh" 4
    run_test "Graceful Shutdown" "scripts/tests/test-shutdown.sh" 5
    
    cleanup_processes
    print_summary
}

trap cleanup_processes EXIT

main "$@"
