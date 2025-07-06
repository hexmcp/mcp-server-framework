#!/bin/bash

echo "🛠️  Testing MCP Capabilities Registration..."

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Error: dist/note-server.js not found. Run 'pnpm build' first."
    exit 1
fi

TEMP_DIR=$(mktemp -d)

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

send_request() {
    local request="$1"
    local timeout_duration="${2:-3}"

    echo "$request" | timeout "$timeout_duration" socat - "EXEC:./start-server-prod.sh" 2>/dev/null | head -1
}

send_mcp_sequence() {
    local operational_request="$1"
    local timeout_duration="${2:-5}"

    timeout "$timeout_duration" bash -c "
        FIFO=\$(mktemp -u)
        mkfifo \"\$FIFO\"
        ./start-server-prod.sh < \"\$FIFO\" &
        SERVER_PID=\$!
        exec 3>\"\$FIFO\"

        # Initialize
        echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0.0\"}}}' >&3
        sleep 0.2

        # Initialized notification
        echo '{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\",\"params\":{}}' >&3
        sleep 0.2

        # Operational request
        echo '$operational_request' >&3
        sleep 0.5

        exec 3>&-
        kill \$SERVER_PID 2>/dev/null
        rm -f \"\$FIFO\"
    " 2>/dev/null | tail -1
}

echo "🤝 Step 1: Initialize server..."
INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
INIT_RESPONSE=$(send_request "$INIT_REQUEST")

if [ -z "$INIT_RESPONSE" ]; then
    echo "❌ Error: No response to initialize request"
    exit 1
fi

echo "📥 Initialize response received"

if ! echo "$INIT_RESPONSE" | jq . >/dev/null 2>&1; then
    echo "❌ Error: Initialize response is not valid JSON"
    echo "Response: $INIT_RESPONSE"
    exit 1
fi

HAS_ERROR=$(echo "$INIT_RESPONSE" | jq 'has("error")')
if [ "$HAS_ERROR" = "true" ]; then
    echo "❌ Error: Initialize request failed"
    echo "$INIT_RESPONSE" | jq '.error'
    exit 1
fi

echo "✅ Server initialized successfully"
echo ""

ERRORS=0

echo "🔧 Step 2: Testing tools/list..."
TOOLS_REQUEST='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
TOOLS_RESPONSE=$(send_mcp_sequence "$TOOLS_REQUEST")

if [ -z "$TOOLS_RESPONSE" ]; then
    echo "❌ Error: No response to tools/list request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Tools response: $TOOLS_RESPONSE"
    
    if ! echo "$TOOLS_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Tools response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_TOOLS_ERROR=$(echo "$TOOLS_RESPONSE" | jq 'has("error")')
        if [ "$HAS_TOOLS_ERROR" = "true" ]; then
            echo "❌ Error: tools/list request failed"
            echo "$TOOLS_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            TOOLS_COUNT=$(echo "$TOOLS_RESPONSE" | jq '.result.tools | length')
            echo "📊 Found $TOOLS_COUNT tools"
            
            HAS_ADD_NOTE=$(echo "$TOOLS_RESPONSE" | jq '.result.tools[] | select(.name == "addNote") | length > 0')
            if [ "$HAS_ADD_NOTE" = "true" ]; then
                echo "✅ addNote tool found"
                
                ADD_NOTE_DESCRIPTION=$(echo "$TOOLS_RESPONSE" | jq -r '.result.tools[] | select(.name == "addNote") | .description')
                echo "  Description: $ADD_NOTE_DESCRIPTION"
                
                HAS_PARAMETERS=$(echo "$TOOLS_RESPONSE" | jq '.result.tools[] | select(.name == "addNote") | has("inputSchema")')
                echo "  Has input schema: $HAS_PARAMETERS"
            else
                echo "❌ Error: addNote tool not found"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
fi

echo ""

echo "📚 Step 3: Testing resources/list..."
RESOURCES_REQUEST='{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}'
RESOURCES_RESPONSE=$(send_mcp_sequence "$RESOURCES_REQUEST")

if [ -z "$RESOURCES_RESPONSE" ]; then
    echo "❌ Error: No response to resources/list request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Resources response: $RESOURCES_RESPONSE"
    
    if ! echo "$RESOURCES_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Resources response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_RESOURCES_ERROR=$(echo "$RESOURCES_RESPONSE" | jq 'has("error")')
        if [ "$HAS_RESOURCES_ERROR" = "true" ]; then
            echo "❌ Error: resources/list request failed"
            echo "$RESOURCES_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            RESOURCES_COUNT=$(echo "$RESOURCES_RESPONSE" | jq '.result.resources | length')
            echo "📊 Found $RESOURCES_COUNT resources"
            
            NOTES_RESOURCES=$(echo "$RESOURCES_RESPONSE" | jq '.result.resources[] | select(.uri | startswith("notes://")) | .uri' | wc -l)
            if [ "$NOTES_RESOURCES" -gt 0 ]; then
                echo "✅ notes:// resource pattern found ($NOTES_RESOURCES resources)"

                FIRST_NOTES_URI=$(echo "$RESOURCES_RESPONSE" | jq -r '.result.resources[] | select(.uri | startswith("notes://")) | .uri' | head -1)
                echo "  Example URI: $FIRST_NOTES_URI"
            else
                echo "❌ Error: notes:// resource pattern not found"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
fi

echo ""

echo "💬 Step 4: Testing prompts/list..."
PROMPTS_REQUEST='{"jsonrpc":"2.0","id":4,"method":"prompts/list","params":{}}'
PROMPTS_RESPONSE=$(send_mcp_sequence "$PROMPTS_REQUEST")

if [ -z "$PROMPTS_RESPONSE" ]; then
    echo "❌ Error: No response to prompts/list request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Prompts response: $PROMPTS_RESPONSE"
    
    if ! echo "$PROMPTS_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Prompts response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_PROMPTS_ERROR=$(echo "$PROMPTS_RESPONSE" | jq 'has("error")')
        if [ "$HAS_PROMPTS_ERROR" = "true" ]; then
            echo "❌ Error: prompts/list request failed"
            echo "$PROMPTS_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            PROMPTS_COUNT=$(echo "$PROMPTS_RESPONSE" | jq '.result.prompts | length')
            echo "📊 Found $PROMPTS_COUNT prompts"
            
            HAS_SUMMARIZE_NOTE=$(echo "$PROMPTS_RESPONSE" | jq '.result.prompts[] | select(.name == "summarizeNote") | length > 0')
            if [ "$HAS_SUMMARIZE_NOTE" = "true" ]; then
                echo "✅ summarizeNote prompt found"
                
                SUMMARIZE_DESCRIPTION=$(echo "$PROMPTS_RESPONSE" | jq -r '.result.prompts[] | select(.name == "summarizeNote") | .description')
                echo "  Description: $SUMMARIZE_DESCRIPTION"
            else
                echo "❌ Error: summarizeNote prompt not found"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
fi

echo ""

echo "🎯 Step 5: Testing capabilities in initialize response..."
CAPABILITIES=$(echo "$INIT_RESPONSE" | jq '.result.capabilities')
echo "📋 Server capabilities: $CAPABILITIES"

HAS_TOOLS_CAP=$(echo "$CAPABILITIES" | jq 'has("tools")')
HAS_RESOURCES_CAP=$(echo "$CAPABILITIES" | jq 'has("resources")')
HAS_PROMPTS_CAP=$(echo "$CAPABILITIES" | jq 'has("prompts")')

echo "  Tools capability: $HAS_TOOLS_CAP"
echo "  Resources capability: $HAS_RESOURCES_CAP"
echo "  Prompts capability: $HAS_PROMPTS_CAP"

if [ "$HAS_TOOLS_CAP" != "true" ]; then
    echo "❌ Error: Missing tools capability"
    ERRORS=$((ERRORS + 1))
fi

if [ "$HAS_RESOURCES_CAP" != "true" ]; then
    echo "❌ Error: Missing resources capability"
    ERRORS=$((ERRORS + 1))
fi

if [ "$HAS_PROMPTS_CAP" != "true" ]; then
    echo "❌ Error: Missing prompts capability"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📈 Summary:"
echo "  Initialize: ✅"
echo "  Tools registered: $([ "$HAS_ADD_NOTE" = "true" ] && echo "✅" || echo "❌")"
echo "  Resources registered: $([ "$NOTES_RESOURCES" -gt 0 ] && echo "✅" || echo "❌")"
echo "  Prompts registered: $([ "$HAS_SUMMARIZE_NOTE" = "true" ] && echo "✅" || echo "❌")"
echo "  Capabilities declared: $([ "$HAS_TOOLS_CAP" = "true" ] && [ "$HAS_RESOURCES_CAP" = "true" ] && [ "$HAS_PROMPTS_CAP" = "true" ] && echo "✅" || echo "❌")"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Capabilities test PASSED"
    echo "🛠️  All components are properly registered and accessible"
else
    echo "❌ Capabilities test FAILED ($ERRORS errors)"
    echo "💡 Check component registration in note-server.ts"
    exit 1
fi
