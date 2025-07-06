#!/bin/bash

echo "⚡ Quick MCP Server Verification"
echo "==============================="
echo ""

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Building server first..."
    if ! pnpm build; then
        echo "❌ Build failed"
        exit 1
    fi
fi

echo "🧪 Testing basic handshake..."

INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"quick-test","version":"1.0.0"}}}'

RESPONSE=$(echo "$INIT_REQUEST" | timeout 3s ./start-server-prod.sh 2>/dev/null | head -1)

if [ -z "$RESPONSE" ]; then
    echo "❌ No response received"
    exit 1
fi

echo "📥 Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo "✅ Valid JSON response"
    
    JSONRPC=$(echo "$RESPONSE" | jq -r '.jsonrpc // empty')
    ID=$(echo "$RESPONSE" | jq -r '.id // empty')
    HAS_RESULT=$(echo "$RESPONSE" | jq 'has("result")')
    
    if [ "$JSONRPC" = "2.0" ] && [ "$ID" = "1" ] && [ "$HAS_RESULT" = "true" ]; then
        echo "✅ Proper JSON-RPC 2.0 response"
        echo "✅ Quick test PASSED - Server is working!"
        echo ""
        echo "🎯 Ready for Cursor integration!"
        echo "📋 Run './run-debug-tests.sh' for comprehensive testing"
    else
        echo "❌ Invalid JSON-RPC response format"
        exit 1
    fi
else
    echo "❌ Invalid JSON response"
    exit 1
fi
