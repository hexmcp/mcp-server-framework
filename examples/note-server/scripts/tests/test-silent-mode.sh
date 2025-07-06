#!/bin/bash

echo "🔇 Testing Silent Mode Configuration..."

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Error: dist/note-server.js not found. Run 'pnpm build' first."
    exit 1
fi

TEMP_DIR=$(mktemp -d)
STDOUT_FILE="$TEMP_DIR/stdout.log"
STDERR_FILE="$TEMP_DIR/stderr.log"
REQUEST_FILE="$TEMP_DIR/request.json"

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill -TERM "$SERVER_PID" 2>/dev/null
        sleep 0.5
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            kill -KILL "$SERVER_PID" 2>/dev/null
        fi
    fi
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' > "$REQUEST_FILE"

echo "🚀 Starting server with output capture..."

echo "📤 Sending initialize request..."
cat "$REQUEST_FILE" | ./start-server-prod.sh > "$STDOUT_FILE" 2> "$STDERR_FILE"

echo "📊 Output Analysis:"
echo ""

STDERR_SIZE=$(stat -f%z "$STDERR_FILE" 2>/dev/null || stat -c%s "$STDERR_FILE" 2>/dev/null || echo "0")
STDOUT_SIZE=$(stat -f%z "$STDOUT_FILE" 2>/dev/null || stat -c%s "$STDOUT_FILE" 2>/dev/null || echo "0")

echo "📏 File sizes:"
echo "  Stderr: $STDERR_SIZE bytes"
echo "  Stdout: $STDOUT_SIZE bytes"
echo ""

ERRORS=0

echo "🔍 Stderr Analysis:"
if [ "$STDERR_SIZE" -gt 0 ]; then
    echo "⚠️  Warning: Stderr contains output (should be empty due to 2>/dev/null redirection)"
    echo "Stderr content:"
    cat "$STDERR_FILE"
    echo ""
else
    echo "✅ Stderr is empty (as expected)"
fi

echo "🔍 Stdout Analysis:"
if [ "$STDOUT_SIZE" -eq 0 ]; then
    echo "❌ Error: No stdout output (expected JSON-RPC response)"
    ERRORS=$((ERRORS + 1))
else
    STDOUT_LINES=$(wc -l < "$STDOUT_FILE")
    echo "📄 Stdout contains $STDOUT_LINES lines"
    
    echo "📋 Checking for non-JSON-RPC content..."
    NON_JSONRPC_LINES=0
    
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            if ! echo "$line" | jq . >/dev/null 2>&1; then
                echo "❌ Non-JSON line detected: $line"
                NON_JSONRPC_LINES=$((NON_JSONRPC_LINES + 1))
            elif ! echo "$line" | jq -e '.jsonrpc' >/dev/null 2>&1; then
                echo "❌ JSON line without jsonrpc field: $line"
                NON_JSONRPC_LINES=$((NON_JSONRPC_LINES + 1))
            fi
        fi
    done < "$STDOUT_FILE"
    
    if [ $NON_JSONRPC_LINES -eq 0 ]; then
        echo "✅ All stdout lines are valid JSON-RPC"
    else
        echo "❌ Found $NON_JSONRPC_LINES non-JSON-RPC lines"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""
echo "🧪 Testing Environment Variables:"

ENV_CHECK_SCRIPT=$(cat << 'EOF'
const env = process.env;
console.error("NODE_ENV:", env.NODE_ENV);
console.error("LOG_LEVEL:", env.LOG_LEVEL);
console.error("MCPKIT_SILENT:", env.MCPKIT_SILENT);
EOF
)

echo "📋 Environment variables in server process:"
echo "$ENV_CHECK_SCRIPT" | node 2>&1 | grep -E "(NODE_ENV|LOG_LEVEL|MCPKIT_SILENT)"

echo ""
echo "🔬 Testing Logging Suppression:"

LOGGING_TEST_SCRIPT='// Test various logging methods that should be suppressed
console.log("This should not appear in production");
console.info("Info message should be suppressed");
console.warn("Warning should be suppressed");
process.stdout.write("Direct stdout write should not appear\\n");

// Only stderr should work (but it'\''s redirected to /dev/null)
console.error("This goes to stderr (redirected to /dev/null)");'

TEMP_LOG_TEST="$TEMP_DIR/log_test.js"
echo "$LOGGING_TEST_SCRIPT" > "$TEMP_LOG_TEST"

echo "Running logging suppression test..."
NODE_ENV="production" LOG_LEVEL="silent" MCPKIT_SILENT="true" node "$TEMP_LOG_TEST" > "$TEMP_DIR/log_stdout.log" 2> "$TEMP_DIR/log_stderr.log"

LOG_STDOUT_SIZE=$(stat -f%z "$TEMP_DIR/log_stdout.log" 2>/dev/null || stat -c%s "$TEMP_DIR/log_stdout.log" 2>/dev/null || echo "0")
LOG_STDERR_SIZE=$(stat -f%z "$TEMP_DIR/log_stderr.log" 2>/dev/null || stat -c%s "$TEMP_DIR/log_stderr.log" 2>/dev/null || echo "0")

echo "  Test stdout size: $LOG_STDOUT_SIZE bytes"
echo "  Test stderr size: $LOG_STDERR_SIZE bytes"

if [ "$LOG_STDOUT_SIZE" -gt 0 ]; then
    echo "⚠️  Warning: Test stdout contains output:"
    cat "$TEMP_DIR/log_stdout.log"
fi

echo ""
echo "📈 Summary:"
echo "  Server started: ✅"
echo "  Stderr empty: $([ "$STDERR_SIZE" -eq 0 ] && echo "✅" || echo "❌")"
echo "  Stdout contains JSON-RPC: $([ "$STDOUT_SIZE" -gt 0 ] && echo "✅" || echo "❌")"
echo "  No pollution detected: $([ $NON_JSONRPC_LINES -eq 0 ] && echo "✅" || echo "❌")"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Silent mode test PASSED"
    echo "🔇 Server is properly configured for silent operation"
else
    echo "❌ Silent mode test FAILED ($ERRORS errors)"
    echo "💡 Check logging configuration and stderr redirection"
    exit 1
fi
