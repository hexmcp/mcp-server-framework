#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 MCP Note Server - Manual Testing Script"
echo "=========================================="

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    pnpm build
fi

echo ""
echo "🎯 Starting MCP Note Server..."
echo "   - Server will listen on stdin/stdout"
echo "   - Send JSON-RPC 2.0 requests"
echo "   - Press Ctrl+C to exit"
echo ""

echo "📋 Example requests you can try:"
echo ""

echo "1. Initialize the server:"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'
echo ""

echo "2. List available tools:"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
echo ""

echo "3. Create a note:"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"addNote","arguments":{"title":"My First Note","content":"This is the content of my first note."}}}'
echo ""

echo "4. List notes resources:"
echo '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{"uri":"notes://"}}'
echo ""

echo "5. Get all notes:"
echo '{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"notes://"}}'
echo ""

echo "6. Summarize a note (replace UUID with actual note ID):"
echo '{"jsonrpc":"2.0","id":6,"method":"prompts/get","params":{"name":"summarizeNote","arguments":{"noteId":"YOUR_NOTE_ID_HERE"}}}'
echo ""

echo "7. List available prompts:"
echo '{"jsonrpc":"2.0","id":7,"method":"prompts/list","params":{}}'
echo ""

echo "8. List available resources:"
echo '{"jsonrpc":"2.0","id":8,"method":"resources/list","params":{}}'
echo ""

echo "=========================================="
echo "🎮 Server is ready! Send your JSON-RPC requests:"
echo ""

export NODE_ENV=development
export LOG_LEVEL=debug

if [ -f "node_modules/.bin/tsx" ]; then
    npx tsx src/note-server.ts
elif command -v tsx >/dev/null 2>&1; then
    tsx src/note-server.ts
else
    echo "❌ Error: tsx not found."
    echo "   Please install tsx: pnpm add -D tsx"
    exit 1
fi
