#!/bin/bash

echo "🤝 Testing MCP Handshake Protocol..."

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

echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"experimental":{},"sampling":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' > "$REQUEST_FILE"

echo "📤 Sending initialize request..."
echo "Request: $(cat "$REQUEST_FILE")"
echo ""

cat "$REQUEST_FILE" | timeout 5s ./start-server-prod.sh > "$STDOUT_FILE" 2> "$STDERR_FILE"

echo "📥 Server response analysis:"
echo ""

if [ ! -s "$STDOUT_FILE" ]; then
    echo "❌ Error: No stdout output received"
    echo "Stderr content:"
    cat "$STDERR_FILE"
    exit 1
fi

RESPONSE=$(head -1 "$STDOUT_FILE")
echo "Raw response: $RESPONSE"
echo ""

if [ -z "$RESPONSE" ]; then
    echo "❌ Error: Empty response"
    exit 1
fi

if ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo "❌ Error: Response is not valid JSON"
    echo "Response: $RESPONSE"
    exit 1
fi

JSONRPC_VERSION=$(echo "$RESPONSE" | jq -r '.jsonrpc // empty')
RESPONSE_ID=$(echo "$RESPONSE" | jq -r '.id // empty')
HAS_RESULT=$(echo "$RESPONSE" | jq 'has("result")')
HAS_ERROR=$(echo "$RESPONSE" | jq 'has("error")')

echo "🔍 Response validation:"
echo "  JSON-RPC version: $JSONRPC_VERSION"
echo "  Response ID: $RESPONSE_ID"
echo "  Has result: $HAS_RESULT"
echo "  Has error: $HAS_ERROR"
echo ""

ERRORS=0

if [ "$JSONRPC_VERSION" != "2.0" ]; then
    echo "❌ Error: Invalid JSON-RPC version (expected '2.0', got '$JSONRPC_VERSION')"
    ERRORS=$((ERRORS + 1))
fi

if [ "$RESPONSE_ID" != "1" ]; then
    echo "❌ Error: Invalid response ID (expected '1', got '$RESPONSE_ID')"
    ERRORS=$((ERRORS + 1))
fi

if [ "$HAS_RESULT" != "true" ]; then
    echo "❌ Error: Response missing 'result' field"
    ERRORS=$((ERRORS + 1))
fi

if [ "$HAS_ERROR" = "true" ]; then
    echo "❌ Error: Response contains error field"
    ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo "  Error message: $ERROR_MESSAGE"
    ERRORS=$((ERRORS + 1))
fi

if [ "$HAS_RESULT" = "true" ]; then
    PROTOCOL_VERSION=$(echo "$RESPONSE" | jq -r '.result.protocolVersion // empty')
    HAS_CAPABILITIES=$(echo "$RESPONSE" | jq '.result | has("capabilities")')
    HAS_SERVER_INFO=$(echo "$RESPONSE" | jq '.result | has("serverInfo")')
    
    echo "📋 Result content validation:"
    echo "  Protocol version: $PROTOCOL_VERSION"
    echo "  Has capabilities: $HAS_CAPABILITIES"
    echo "  Has serverInfo: $HAS_SERVER_INFO"
    
    if [ "$PROTOCOL_VERSION" != "2025-06-18" ]; then
        echo "❌ Error: Invalid protocol version (expected '2025-06-18', got '$PROTOCOL_VERSION')"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ "$HAS_CAPABILITIES" != "true" ]; then
        echo "❌ Error: Missing capabilities in result"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ "$HAS_SERVER_INFO" != "true" ]; then
        echo "❌ Error: Missing serverInfo in result"
        ERRORS=$((ERRORS + 1))
    fi
fi

STDOUT_LINES=$(wc -l < "$STDOUT_FILE")
if [ "$STDOUT_LINES" -gt 1 ]; then
    echo "⚠️  Warning: Multiple lines in stdout (expected 1, got $STDOUT_LINES)"
    echo "Additional lines:"
    tail -n +2 "$STDOUT_FILE"
fi

if [ -s "$STDERR_FILE" ]; then
    echo "⚠️  Warning: Stderr output detected (should be redirected to /dev/null)"
    echo "Stderr content:"
    cat "$STDERR_FILE"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Handshake test PASSED"
    echo "📄 Full response:"
    echo "$RESPONSE" | jq .
else
    echo "❌ Handshake test FAILED ($ERRORS errors)"
    exit 1
fi
