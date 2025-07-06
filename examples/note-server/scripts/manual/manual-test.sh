#!/bin/bash

echo "🧪 Manual MCP Server Test"
echo "========================="
echo ""

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Error: dist/note-server.js not found. Run 'pnpm build' first."
    exit 1
fi

echo "🚀 Starting MCP server..."
echo "📤 You can send JSON-RPC requests manually"
echo "📋 Press Ctrl+C to exit"
echo ""

echo "💡 Example requests to try:"
echo ""
echo "1. Initialize:"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual-test","version":"1.0.0"}}}'
echo ""
echo "2. List tools:"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
echo ""
echo "3. Add a note:"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"addNote","arguments":{"title":"Manual Test","content":"This note was created manually"}}}'
echo ""
echo "4. List resources:"
echo '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}'
echo ""
echo "5. Get notes resource:"
echo '{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"notes://all"}}'
echo ""

echo "🎯 Starting server (type requests above):"
echo "----------------------------------------"

exec ./start-server-prod.sh
