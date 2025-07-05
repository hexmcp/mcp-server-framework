# MCP Note Server Example

A comprehensive example implementation of an MCP (Model Context Protocol) server using the MCP Server Framework. This note-taking server demonstrates the framework's capabilities through practical tools, resources, and prompts.

## 🎯 Overview

This example showcases:

- **Tool Handlers**: Create notes with validation
- **Resource Handlers**: Access notes via URI patterns with list/get operations  
- **Prompt Handlers**: Generate note summaries with configurable length
- **Middleware Integration**: Transport-aware logging and error handling with stderr-only output for stdio compatibility
- **Transport Layer**: stdio transport for JSON-RPC communication with automatic logging detection
- **Testing Infrastructure**: Comprehensive fixture-based testing
- **Type Safety**: Full TypeScript implementation with Zod validation

## 🏗️ Architecture

```
src/
├── note-server.ts           # Main server using createMcpKitServer() DSL
├── domain/
│   └── notes.ts             # Note interface, store, and business logic
└── handlers/
    ├── tools.ts             # addNote tool handler
    ├── prompts.ts           # summarizeNote prompt handler
    └── resources.ts         # notes:// resource handler

fixtures/                    # JSON-RPC test fixtures
├── tools/                   # Tool operation fixtures
├── prompts/                 # Prompt generation fixtures
└── resources/               # Resource access fixtures

tests/
└── note-server.test.ts      # Jest tests using runFixture()
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# From the project root
cd examples/note-server
pnpm install
```

### Development

```bash
# Build TypeScript
pnpm build

# Run in development mode with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Manual Testing

Use the provided script for interactive testing:

```bash
./run.sh
```

This starts the server and provides example JSON-RPC requests you can send via stdin.

## 📡 API Reference

### Tools

#### `addNote`

Creates a new note with title and content. Demonstrates transport-aware streaming progress updates.

**Parameters:**
- `title` (string, required): Note title (max 200 chars)
- `content` (string, required): Note content (max 10,000 chars)

**Streaming Progress**: For non-stdio transports, this tool sends progress updates during execution:
1. "Validating note input..."
2. "Creating note in storage..."
3. "Note creation completed successfully"

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "addNote",
    "arguments": {
      "title": "Meeting Notes",
      "content": "Discussed project timeline and deliverables."
    }
  }
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully created note with ID: 123e4567-e89b-12d3-a456-426614174000"
      }
    ],
    "isError": false,
    "metadata": {
      "noteId": "123e4567-e89b-12d3-a456-426614174000",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Resources

#### `notes://`

Access notes via URI patterns.

**Supported URIs:**
- `notes://` - List all notes or get all notes data
- `notes://{uuid}` - Get specific note by ID

**List Notes:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list",
  "params": {
    "uri": "notes://"
  }
}
```

**Get All Notes:**
```json
{
  "jsonrpc": "2.0", 
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "notes://"
  }
}
```

**Get Specific Note:**
```json
{
  "jsonrpc": "2.0",
  "id": 4, 
  "method": "resources/read",
  "params": {
    "uri": "notes://123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Prompts

#### `summarizeNote`

Generates a summary of a note by ID.

**Arguments:**
- `noteId` (string, required): UUID of the note to summarize
- `maxLength` (number, optional): Maximum summary length (50-500 chars, default: 150)

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "prompts/get", 
  "params": {
    "name": "summarizeNote",
    "arguments": {
      "noteId": "123e4567-e89b-12d3-a456-426614174000",
      "maxLength": 100
    }
  }
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "# Note Summary\n\n**Title:** Meeting Notes\n\n**Summary:** Note \"Meeting Notes\": Discussed project timeline and deliverables.\n\n**Statistics:**\n- Created: 1/15/2024\n- Word count: 6\n- Character count: 45\n- Last updated: 1/15/2024"
      }
    ]
  }
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage report
pnpm test:coverage
```

### Fixture-Based Testing

The example uses the framework's fixture-based testing approach:

```typescript
import { runFixture } from '@hexmcp/testing';

it('should create a note successfully', async () => {
  await runFixture(join(fixturesDir, 'tools', 'add-note.req.json'));
});
```

Fixtures are JSON files containing:
- `name`: Test case description
- `input`: JSON-RPC request
- `expected`: Expected response

### Test Coverage

The test suite covers:
- ✅ Tool validation and execution
- ✅ Resource URI pattern matching
- ✅ Prompt argument validation
- ✅ Error handling scenarios
- ✅ Integration workflows
- ✅ Data consistency

## 🔧 Implementation Details

### Transport-Aware Logging

This example demonstrates the framework's transport-aware logging capabilities that prevent interference with the MCP stdio protocol:

#### Automatic Transport Detection
The built-in logging middleware automatically detects when using stdio transport and switches to stderr-only logging:

```typescript
.use(builtIn.logging({
  // No custom logger specified - automatic detection
  // For stdio transport: uses stderr to avoid JSON-RPC interference
  // For other transports: uses standard console logging
}))
```

#### Manual Stderr Logging
For explicit control, you can use the `createStderrLogger()` utility:

```typescript
import { createStderrLogger } from '@hexmcp/core';

.use(createErrorMapperMiddleware({
  logger: createStderrLogger(), // Explicit stderr logging
}))
```

#### Why Stderr for Stdio Transport?
- **Protocol Safety**: MCP clients communicate via stdin/stdout for JSON-RPC messages
- **Log Separation**: stderr output doesn't interfere with the JSON-RPC handshake
- **Debug Visibility**: Logs remain visible for debugging while keeping protocol clean
- **Transport Awareness**: Other transports (WebSocket, HTTP) can use standard logging

#### Streaming Info Support
The `createStreamingInfoMiddleware()` provides transport-aware progress updates:

```typescript
// In tool handlers
const streamingCtx = ctx as StreamingRequestContext;
streamingCtx.streamInfo?.('Processing step 1 of 3...');
// For stdio: streamInfo is undefined (no interference)
// For other transports: sends progress updates to client
```

## 🔧 Implementation Details

### Server Configuration

The main server uses the fluent DSL pattern with transport-aware logging:

```typescript
import {
  createMcpKitServer,
  createBuiltInMiddleware,
  createStreamingInfoMiddleware,
  createStderrLogger
} from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';

const builtIn = createBuiltInMiddleware();

const server = createMcpKitServer()
  .use(createStreamingInfoMiddleware()) // Transport-aware streaming support
  .use(createErrorMapperMiddleware({
    enableLogging: true,
    debugMode: process.env.NODE_ENV === 'dev',
    logger: createStderrLogger(), // Explicit stderr logging for error mapper
  }))
  .use(builtIn.logging({
    level: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
    // No custom logger - automatic transport detection uses stderr for stdio
  }))
  .tool('addNote', addNoteTool)
  .resource('notes://**', notesResource)
  .prompt('summarizeNote', summarizeNotePrompt)
  .transport(new StdioTransport())
  .listen();
```

### Domain Model

```typescript
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Validation

Uses Zod schemas for input validation:

```typescript
const AddNoteInputSchema = z.object({
  title: z.string()
    .min(1, 'Title is required and cannot be empty')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),
  content: z.string()
    .min(1, 'Content is required and cannot be empty')
    .max(10000, 'Content cannot exceed 10,000 characters')
    .trim(),
});
```

## 🚀 Extending the Example

### Adding New Tools

1. Create a new tool definition in `handlers/tools.ts`:

```typescript
export const deleteNoteTool: Omit<ToolDefinition, 'name'> = {
  description: 'Delete a note by ID',
  parameters: [
    {
      name: 'noteId',
      description: 'UUID of the note to delete',
      required: true,
      type: 'string',
    },
  ],
  handler: async (args) => {
    // Implementation here
  },
};
```

2. Register it in the server:

```typescript
const server = createMcpKitServer()
  // ... other configuration
  .tool('deleteNote', deleteNoteTool)
  // ... rest of configuration
```

3. Add fixtures and tests for the new tool.

### Adding New Resources

1. Define a new resource pattern:

```typescript
export const tagsResource: Omit<ResourceDefinition, 'uriPattern'> = {
  name: 'Note Tags',
  description: 'Access note tags and categories',
  provider: {
    get: async (uri) => {
      // Implementation
    },
    list: async (cursor) => {
      // Implementation
    },
  },
};
```

2. Register with a URI pattern:

```typescript
.resource('tags://**', tagsResource)
```

### Adding Custom Middleware

```typescript
const customMiddleware: Middleware = async (ctx, next) => {
  console.log(`Processing ${ctx.request.method}`);
  await next();
  console.log(`Completed ${ctx.request.method}`);
};

const server = createMcpKitServer()
  .use(customMiddleware)
  // ... rest of configuration
```

## 🔍 Troubleshooting

### Common Issues

1. **Server not starting**: Check Node.js version (18+ required)
2. **TypeScript errors**: Run `pnpm typecheck` to identify issues
3. **Test failures**: Ensure fixtures match current implementation
4. **Transport errors**: Verify JSON-RPC 2.0 format in requests

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development LOG_LEVEL=debug ./run.sh
```

### Logs

The server logs all requests/responses to stderr in development mode (safe for stdio transport):

```json
{"level":"info","message":"Request started","timestamp":"2024-01-15T10:30:00.000Z","meta":{"traceId":"abc123","method":"tools/call","transport":"stdio"}}
{"level":"info","message":"Request completed","timestamp":"2024-01-15T10:30:00.001Z","meta":{"traceId":"abc123","method":"tools/call","status":"ok","durationMs":45}}
```

**Note**: All logs are written to stderr to prevent interference with the JSON-RPC protocol over stdin/stdout. This ensures clean communication between the MCP client and server while maintaining full observability.

## 📚 Further Reading

- [MCP Server Framework Documentation](../../docs/README.md)
- [Core Package Reference](../../packages/core/README.md)
- [Testing Package Guide](../../packages/testing/README.md)
- [Transport Layer Documentation](../../packages/transport/README.md)

## 📄 License

MIT License - see the [LICENSE](../../LICENSE) file for details.
