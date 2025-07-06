#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the note-server directory
cd "$SCRIPT_DIR"

# Set production environment with silent logging
export NODE_ENV="production"
export LOG_LEVEL="silent"
export MCPKIT_SILENT="true"

# Redirect stderr to /dev/null to suppress all logging output
# Only JSON-RPC messages will be sent to stdout
exec node dist/note-server.js 2>/dev/null
