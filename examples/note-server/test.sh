#!/bin/bash

echo "🧪 MCP Server Test Wrapper"
echo "=========================="
echo ""

cd "$(dirname "$0")"

if [ "$1" = "quick" ]; then
    echo "🚀 Running quick test..."
    ./scripts/debug/quick-test.sh
elif [ "$1" = "manual" ]; then
    echo "🎮 Starting manual test session..."
    ./scripts/manual/manual-test.sh
elif [ "$1" = "dev" ]; then
    echo "🛠️ Starting development server..."
    ./scripts/dev/start-server-dev-debug.sh
else
    echo "🧪 Running complete test suite..."
    ./scripts/tests/run-debug-tests.sh
fi
