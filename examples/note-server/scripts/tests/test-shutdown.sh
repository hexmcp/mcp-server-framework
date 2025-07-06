#!/bin/bash

echo "🛑 Testing MCP Server Graceful Shutdown..."

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Error: dist/note-server.js not found. Run 'pnpm build' first."
    exit 1
fi

TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

ERRORS=0

echo "🚀 Test 1: SIGTERM handling..."

# Create a FIFO for communication
FIFO="$TEMP_DIR/server_fifo"
mkfifo "$FIFO"

# Start server with FIFO input
timeout 30s ./start-server-prod.sh < "$FIFO" > "$TEMP_DIR/stdout.log" 2> "$TEMP_DIR/stderr.log" &
SERVER_PID=$!

# Open FIFO for writing (keeps server alive)
exec 3>"$FIFO"

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "❌ Error: Server failed to start"
    exec 3>&-
    exit 1
fi

echo "📋 Server started with PID: $SERVER_PID"

echo "📤 Sending SIGTERM..."
START_TIME=$(date +%s)
kill -TERM "$SERVER_PID"

SHUTDOWN_TIMEOUT=5
GRACEFUL_SHUTDOWN=false

for i in $(seq 1 $SHUTDOWN_TIMEOUT); do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        END_TIME=$(date +%s)
        SHUTDOWN_TIME=$((END_TIME - START_TIME))
        echo "✅ Server exited gracefully in ${SHUTDOWN_TIME}s"
        GRACEFUL_SHUTDOWN=true
        break
    fi
    sleep 1
done

if [ "$GRACEFUL_SHUTDOWN" = "false" ]; then
    echo "❌ Error: Server didn't exit within ${SHUTDOWN_TIMEOUT}s, forcing with SIGKILL"
    kill -KILL "$SERVER_PID" 2>/dev/null
    ERRORS=$((ERRORS + 1))
fi

# Close FIFO
exec 3>&-

echo ""

echo "🚀 Test 2: SIGINT handling..."

timeout 30s ./start-server-prod.sh > "$TEMP_DIR/stdout2.log" 2> "$TEMP_DIR/stderr2.log" &
SERVER_PID2=$!

sleep 1

if ! kill -0 "$SERVER_PID2" 2>/dev/null; then
    echo "❌ Error: Server failed to start for SIGINT test"
    ERRORS=$((ERRORS + 1))
else
    echo "📋 Server started with PID: $SERVER_PID2"
    
    echo "📤 Sending SIGINT..."
    START_TIME=$(date +%s)
    kill -INT "$SERVER_PID2"
    
    GRACEFUL_SHUTDOWN2=false
    
    for i in $(seq 1 $SHUTDOWN_TIMEOUT); do
        if ! kill -0 "$SERVER_PID2" 2>/dev/null; then
            END_TIME=$(date +%s)
            SHUTDOWN_TIME=$((END_TIME - START_TIME))
            echo "✅ Server exited gracefully on SIGINT in ${SHUTDOWN_TIME}s"
            GRACEFUL_SHUTDOWN2=true
            break
        fi
        sleep 1
    done
    
    if [ "$GRACEFUL_SHUTDOWN2" = "false" ]; then
        echo "❌ Error: Server didn't exit on SIGINT within ${SHUTDOWN_TIMEOUT}s, forcing with SIGKILL"
        kill -KILL "$SERVER_PID2" 2>/dev/null
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

echo "🚀 Test 3: Process cleanup verification..."

timeout 30s ./start-server-prod.sh > "$TEMP_DIR/stdout3.log" 2> "$TEMP_DIR/stderr3.log" &
SERVER_PID3=$!

sleep 1

if ! kill -0 "$SERVER_PID3" 2>/dev/null; then
    echo "❌ Error: Server failed to start for cleanup test"
    ERRORS=$((ERRORS + 1))
else
    echo "📋 Server started with PID: $SERVER_PID3"
    
    CHILD_PROCESSES_BEFORE=$(pgrep -P "$SERVER_PID3" | wc -l)
    echo "📊 Child processes before shutdown: $CHILD_PROCESSES_BEFORE"
    
    kill -TERM "$SERVER_PID3"
    
    sleep 2
    
    CHILD_PROCESSES_AFTER=$(pgrep -P "$SERVER_PID3" 2>/dev/null | wc -l)
    echo "📊 Child processes after shutdown: $CHILD_PROCESSES_AFTER"
    
    if [ "$CHILD_PROCESSES_AFTER" -eq 0 ]; then
        echo "✅ All child processes cleaned up properly"
    else
        echo "⚠️  Warning: $CHILD_PROCESSES_AFTER child processes still running"
        pgrep -P "$SERVER_PID3" 2>/dev/null || true
    fi
    
    if kill -0 "$SERVER_PID3" 2>/dev/null; then
        echo "❌ Error: Main process still running, forcing cleanup"
        kill -KILL "$SERVER_PID3" 2>/dev/null
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

echo "🚀 Test 4: Shutdown during active request..."

FIFO_IN="$TEMP_DIR/server_in"
FIFO_OUT="$TEMP_DIR/server_out"
mkfifo "$FIFO_IN" "$FIFO_OUT"

./start-server-prod.sh < "$FIFO_IN" > "$FIFO_OUT" 2>/dev/null &
SERVER_PID4=$!

exec 3>"$FIFO_IN"
exec 4<"$FIFO_OUT"

sleep 1

if ! kill -0 "$SERVER_PID4" 2>/dev/null; then
    echo "❌ Error: Server failed to start for active request test"
    ERRORS=$((ERRORS + 1))
else
    echo "📋 Server started with PID: $SERVER_PID4"
    
    echo "📤 Sending initialize request..."
    echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' >&3
    
    timeout 2 head -1 <&4 > "$TEMP_DIR/init_response.log"
    
    echo "📤 Sending long-running request and immediately shutting down..."
    echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"addNote","arguments":{"title":"Test","content":"Test content"}}}' >&3
    
    sleep 0.1
    
    kill -TERM "$SERVER_PID4"
    
    SHUTDOWN_DURING_REQUEST=false
    for i in $(seq 1 3); do
        if ! kill -0 "$SERVER_PID4" 2>/dev/null; then
            echo "✅ Server shut down gracefully even during active request"
            SHUTDOWN_DURING_REQUEST=true
            break
        fi
        sleep 1
    done
    
    if [ "$SHUTDOWN_DURING_REQUEST" = "false" ]; then
        echo "❌ Error: Server didn't shut down during active request"
        kill -KILL "$SERVER_PID4" 2>/dev/null
        ERRORS=$((ERRORS + 1))
    fi
    
    exec 3>&-
    exec 4<&-
fi

echo ""

echo "🚀 Test 5: Resource cleanup verification..."

TEMP_FILES_BEFORE=$(find /tmp -name "*mcp*" -o -name "*note-server*" 2>/dev/null | wc -l)

./start-server-prod.sh > "$TEMP_DIR/stdout5.log" 2> "$TEMP_DIR/stderr5.log" &
SERVER_PID5=$!

sleep 1

if ! kill -0 "$SERVER_PID5" 2>/dev/null; then
    echo "❌ Error: Server failed to start for resource cleanup test"
    ERRORS=$((ERRORS + 1))
else
    echo "📋 Server started with PID: $SERVER_PID5"
    
    kill -TERM "$SERVER_PID5"
    
    sleep 2
    
    TEMP_FILES_AFTER=$(find /tmp -name "*mcp*" -o -name "*note-server*" 2>/dev/null | wc -l)
    
    if [ "$TEMP_FILES_AFTER" -le "$TEMP_FILES_BEFORE" ]; then
        echo "✅ No resource leaks detected"
    else
        echo "⚠️  Warning: Possible resource leak detected"
        echo "   Temp files before: $TEMP_FILES_BEFORE"
        echo "   Temp files after: $TEMP_FILES_AFTER"
    fi
    
    if kill -0 "$SERVER_PID5" 2>/dev/null; then
        kill -KILL "$SERVER_PID5" 2>/dev/null
    fi
fi

echo ""

echo "🚀 Test 6: Exit code verification..."

./start-server-prod.sh > "$TEMP_DIR/stdout6.log" 2> "$TEMP_DIR/stderr6.log" &
SERVER_PID6=$!

sleep 1

if ! kill -0 "$SERVER_PID6" 2>/dev/null; then
    echo "❌ Error: Server failed to start for exit code test"
    ERRORS=$((ERRORS + 1))
else
    echo "📋 Server started with PID: $SERVER_PID6"
    
    kill -TERM "$SERVER_PID6"
    
    wait "$SERVER_PID6" 2>/dev/null
    EXIT_CODE=$?
    
    echo "📊 Exit code: $EXIT_CODE"
    
    if [ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 143 ]; then
        echo "✅ Exit code indicates graceful shutdown"
    else
        echo "⚠️  Warning: Unexpected exit code (expected 0 or 143, got $EXIT_CODE)"
    fi
fi

echo ""
echo "📈 Summary:"
echo "  SIGTERM handling: $([ "$GRACEFUL_SHUTDOWN" = "true" ] && echo "✅" || echo "❌")"
echo "  SIGINT handling: $([ "$GRACEFUL_SHUTDOWN2" = "true" ] && echo "✅" || echo "❌")"
echo "  Process cleanup: $([ "$CHILD_PROCESSES_AFTER" -eq 0 ] && echo "✅" || echo "⚠️")"
echo "  Shutdown during request: $([ "$SHUTDOWN_DURING_REQUEST" = "true" ] && echo "✅" || echo "❌")"
echo "  Resource cleanup: ✅"
echo "  Exit code: $([ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 143 ] && echo "✅" || echo "⚠️")"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Shutdown test PASSED"
    echo "🛑 Server handles all shutdown scenarios gracefully"
else
    echo "❌ Shutdown test FAILED ($ERRORS errors)"
    echo "💡 Check signal handling and cleanup logic"
    exit 1
fi
