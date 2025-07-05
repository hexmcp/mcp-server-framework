#!/usr/bin/env node

import {
  createBuiltInMiddleware,
  createErrorMapperMiddleware,
  createMcpKitServer,
  createStderrLogger,
  createStreamingInfoMiddleware,
} from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';
import { summarizeNotePrompt } from './handlers/prompts.js';
import { notesResource } from './handlers/resources.js';
import { addNoteTool } from './handlers/tools.js';

const builtIn = createBuiltInMiddleware();

const server = createMcpKitServer()
  .use(createStreamingInfoMiddleware())
  .use(
    createErrorMapperMiddleware({
      enableLogging: true,
      debugMode: process.env.NODE_ENV === 'dev',
      includeStackTrace: process.env.NODE_ENV === 'dev',
      logLevel: 'info',
      logger: createStderrLogger(),
    })
  )
  .use(
    builtIn.logging({
      level: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
      includeRequest: process.env.NODE_ENV === 'dev',
      includeResponse: process.env.NODE_ENV === 'dev',
      // No custom logger - let the middleware automatically detect stdio transport
      // and use stderr-only logging to prevent JSON-RPC interference
    })
  )
  .tool('addNote', addNoteTool)
  .resource('notes://**', notesResource)
  .prompt('summarizeNote', summarizeNotePrompt)
  .transport(new StdioTransport())
  .listen();

process.on('SIGINT', () => {
  // biome-ignore lint/suspicious/noConsole: Stderr logging for graceful shutdown
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  // biome-ignore lint/suspicious/noConsole: Stderr logging for graceful shutdown
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

export default server;
