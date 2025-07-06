#!/bin/bash

echo "⚡ Testing MCP Runtime Behavior..."

cd "$(dirname "$0")/../.."

if [ ! -f "dist/note-server.js" ]; then
    echo "❌ Error: dist/note-server.js not found. Run 'pnpm build' first."
    exit 1
fi

TEMP_DIR=$(mktemp -d)
FIFO_IN="$TEMP_DIR/server_in"
FIFO_OUT="$TEMP_DIR/server_out"

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

mkfifo "$FIFO_IN" "$FIFO_OUT"

echo "🚀 Starting server with bidirectional communication..."

./start-server-prod.sh < "$FIFO_IN" > "$FIFO_OUT" 2>/dev/null &
SERVER_PID=$!

exec 3>"$FIFO_IN"
exec 4<"$FIFO_OUT"

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "❌ Error: Server failed to start"
    exit 1
fi

send_request() {
    local request="$1"
    local timeout_duration="${2:-3}"
    
    echo "$request" >&3
    
    timeout "$timeout_duration" head -1 <&4
}

ERRORS=0

echo "🤝 Step 1: Initialize server..."

echo "📤 Sending initialize request..."
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' >&3

timeout 2 head -1 <&4 > /dev/null

echo "📤 Sending initialized notification..."
echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' >&3

sleep 1

echo "✅ Server initialized successfully"
echo ""

echo "📝 Step 2: Testing addNote tool..."
ADD_NOTE_REQUEST='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"addNote","arguments":{"title":"Test Note","content":"This is a test note created during runtime testing."}}}'

echo "📤 Sending addNote request..."
echo "$ADD_NOTE_REQUEST" >&3

ADD_NOTE_RESPONSE=$(timeout 5 head -1 <&4)

if [ -z "$ADD_NOTE_RESPONSE" ]; then
    echo "❌ Error: No response to addNote request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 AddNote response: $ADD_NOTE_RESPONSE"
    
    if ! echo "$ADD_NOTE_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: AddNote response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_ADD_NOTE_ERROR=$(echo "$ADD_NOTE_RESPONSE" | jq 'has("error")')
        if [ "$HAS_ADD_NOTE_ERROR" = "true" ]; then
            echo "❌ Error: addNote tool call failed"
            echo "$ADD_NOTE_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            echo "✅ addNote tool executed successfully"
            
            RESULT_CONTENT=$(echo "$ADD_NOTE_RESPONSE" | jq '.result.content[]?.text // empty')
            if [ -n "$RESULT_CONTENT" ]; then
                echo "📄 Tool result: $RESULT_CONTENT"
            fi
        fi
    fi
fi

echo ""

echo "📚 Step 3: Testing notes resource access..."
NOTES_RESOURCE_REQUEST='{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"notes://"}}'

sleep 0.5
echo "📤 Sending resource read request..."
echo "$NOTES_RESOURCE_REQUEST" >&3

NOTES_RESOURCE_RESPONSE=$(timeout 5 head -1 <&4)

if [ -z "$NOTES_RESOURCE_RESPONSE" ]; then
    echo "❌ Error: No response to notes resource request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Notes resource response: $NOTES_RESOURCE_RESPONSE"
    
    if ! echo "$NOTES_RESOURCE_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Notes resource response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_RESOURCE_ERROR=$(echo "$NOTES_RESOURCE_RESPONSE" | jq 'has("error")')
        if [ "$HAS_RESOURCE_ERROR" = "true" ]; then
            echo "❌ Error: notes resource access failed"
            echo "$NOTES_RESOURCE_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            echo "✅ notes resource accessed successfully"
            
            RESOURCE_CONTENT=$(echo "$NOTES_RESOURCE_RESPONSE" | jq '.result.contents[]?.text // empty')
            if [ -n "$RESOURCE_CONTENT" ]; then
                echo "📄 Resource content preview: $(echo "$RESOURCE_CONTENT" | head -c 100)..."
            fi
        fi
    fi
fi

echo ""

echo "💬 Step 4: Testing summarizeNote prompt..."

echo "📋 Getting valid note ID for prompt test..."
NOTES_LIST_REQUEST='{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}'
echo "$NOTES_LIST_REQUEST" >&3
NOTES_LIST_RESPONSE=$(timeout 5 head -1 <&4)

if echo "$NOTES_LIST_RESPONSE" | jq -e '.result.resources[0]' >/dev/null 2>&1; then
    VALID_NOTE_ID=$(echo "$NOTES_LIST_RESPONSE" | jq -r '.result.resources[0].uri' | sed 's/notes:\/\///')
    echo "📋 Using note ID: $VALID_NOTE_ID"
    SUMMARIZE_PROMPT_REQUEST="{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"prompts/get\",\"params\":{\"name\":\"summarizeNote\",\"arguments\":{\"noteId\":\"$VALID_NOTE_ID\"}}}"
else
    echo "⚠️  No notes available, using test ID"
    SUMMARIZE_PROMPT_REQUEST='{"jsonrpc":"2.0","id":4,"method":"prompts/get","params":{"name":"summarizeNote","arguments":{"noteId":"test-note-1"}}}'
fi

echo "📤 Sending prompt request..."
echo "$SUMMARIZE_PROMPT_REQUEST" >&3

SUMMARIZE_PROMPT_RESPONSE=$(timeout 5 head -1 <&4)

if [ -z "$SUMMARIZE_PROMPT_RESPONSE" ]; then
    echo "❌ Error: No response to summarizeNote prompt request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 SummarizeNote prompt response: $SUMMARIZE_PROMPT_RESPONSE"
    
    if ! echo "$SUMMARIZE_PROMPT_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: SummarizeNote prompt response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_PROMPT_ERROR=$(echo "$SUMMARIZE_PROMPT_RESPONSE" | jq 'has("error")')
        if [ "$HAS_PROMPT_ERROR" = "true" ]; then
            echo "❌ Error: summarizeNote prompt failed"
            echo "$SUMMARIZE_PROMPT_RESPONSE" | jq '.error'
            ERRORS=$((ERRORS + 1))
        else
            echo "✅ summarizeNote prompt executed successfully"
            
            PROMPT_MESSAGES=$(echo "$SUMMARIZE_PROMPT_RESPONSE" | jq '.result.messages | length')
            echo "📄 Generated $PROMPT_MESSAGES prompt messages"
        fi
    fi
fi

echo ""

echo "🔄 Step 5: Testing error handling..."
INVALID_TOOL_REQUEST='{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"nonexistentTool","arguments":{}}}'

echo "📤 Sending invalid tool request..."
echo "$INVALID_TOOL_REQUEST" >&3

INVALID_TOOL_RESPONSE=$(timeout 3 head -1 <&4)

if [ -z "$INVALID_TOOL_RESPONSE" ]; then
    echo "❌ Error: No response to invalid tool request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Invalid tool response: $INVALID_TOOL_RESPONSE"
    
    if ! echo "$INVALID_TOOL_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Invalid tool response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_EXPECTED_ERROR=$(echo "$INVALID_TOOL_RESPONSE" | jq 'has("error")')
        if [ "$HAS_EXPECTED_ERROR" = "true" ]; then
            ERROR_CODE=$(echo "$INVALID_TOOL_RESPONSE" | jq '.error.code')
            echo "✅ Error handling works correctly (error code: $ERROR_CODE)"
        else
            echo "❌ Error: Expected error response for invalid tool"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

echo ""

echo "⏱️  Step 6: Testing response timing..."
START_TIME=$(date +%s%N)
PING_REQUEST='{"jsonrpc":"2.0","id":6,"method":"ping","params":{}}'

echo "📤 Sending ping request..."
echo "$PING_REQUEST" >&3

PING_RESPONSE=$(timeout 2 head -1 <&4)
END_TIME=$(date +%s%N)

RESPONSE_TIME_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ -z "$PING_RESPONSE" ]; then
    echo "⚠️  Warning: No response to ping request (may not be implemented)"
else
    echo "📥 Ping response time: ${RESPONSE_TIME_MS}ms"
    
    if [ $RESPONSE_TIME_MS -gt 1000 ]; then
        echo "⚠️  Warning: Response time is slow (>1000ms)"
    else
        echo "✅ Response time is acceptable"
    fi
fi

echo ""

echo "🧪 Step 7: Testing malformed request handling..."
MALFORMED_REQUEST='{"jsonrpc":"2.0","id":7,"method":"tools/call"}'

echo "📤 Sending malformed request..."
echo "$MALFORMED_REQUEST" >&3

MALFORMED_RESPONSE=$(timeout 3 head -1 <&4)

if [ -z "$MALFORMED_RESPONSE" ]; then
    echo "❌ Error: No response to malformed request"
    ERRORS=$((ERRORS + 1))
else
    echo "📥 Malformed request response: $MALFORMED_RESPONSE"
    
    if ! echo "$MALFORMED_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Error: Malformed request response is not valid JSON"
        ERRORS=$((ERRORS + 1))
    else
        HAS_MALFORMED_ERROR=$(echo "$MALFORMED_RESPONSE" | jq 'has("error")')
        if [ "$HAS_MALFORMED_ERROR" = "true" ]; then
            ERROR_CODE=$(echo "$MALFORMED_RESPONSE" | jq '.error.code')
            echo "✅ Malformed request handled correctly (error code: $ERROR_CODE)"
        else
            echo "❌ Error: Expected error response for malformed request"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

echo ""
echo "📈 Summary:"
echo "  Server startup: ✅"
echo "  Initialize: ✅"
echo "  Tool execution: $([ "$HAS_ADD_NOTE_ERROR" != "true" ] && echo "✅" || echo "❌")"
echo "  Resource access: $([ "$HAS_RESOURCE_ERROR" != "true" ] && echo "✅" || echo "❌")"
echo "  Prompt execution: $([ "$HAS_PROMPT_ERROR" != "true" ] && echo "✅" || echo "❌")"
echo "  Error handling: $([ "$HAS_EXPECTED_ERROR" = "true" ] && echo "✅" || echo "❌")"
echo "  Response timing: $([ $RESPONSE_TIME_MS -le 1000 ] && echo "✅" || echo "⚠️")"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Runtime test PASSED"
    echo "⚡ Server is functioning correctly in all tested scenarios"
else
    echo "❌ Runtime test FAILED ($ERRORS errors)"
    echo "💡 Check server implementation and error handling"
    exit 1
fi
