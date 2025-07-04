#!/usr/bin/env node

import { createBuiltInMiddleware, createErrorMapperMiddleware, createMcpKitServer } from '@hexmcp/core';
import { StdioTransport } from '@hexmcp/transport-stdio';
import { summarizeNotePrompt } from './handlers/prompts.js';
import { notesResource } from './handlers/resources.js';
import { addNoteTool } from './handlers/tools.js';

const stderrLogger = {
  error: (message: string, meta?: unknown) => {
    const logData = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...(meta && typeof meta === 'object' ? meta : { meta }),
    };
    // biome-ignore lint/suspicious/noConsole: Intentional stderr logging for MCP server
    console.error(JSON.stringify(logData));
  },
  warn: (message: string, meta?: unknown) => {
    const logData = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...(meta && typeof meta === 'object' ? meta : { meta }),
    };
    // biome-ignore lint/suspicious/noConsole: Intentional stderr logging for MCP server
    console.error(JSON.stringify(logData));
  },
  info: (message: string, meta?: unknown) => {
    const logData = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...(meta && typeof meta === 'object' ? meta : { meta }),
    };
    // biome-ignore lint/suspicious/noConsole: Intentional stderr logging for MCP server
    console.error(JSON.stringify(logData));
  },
  debug: (message: string, meta?: unknown) => {
    const logData = {
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      ...(meta && typeof meta === 'object' ? meta : { meta }),
    };
    // biome-ignore lint/suspicious/noConsole: Intentional stderr logging for MCP server
    console.error(JSON.stringify(logData));
  },
  log: (level: string, message: string, meta?: unknown) => {
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(meta && typeof meta === 'object' ? meta : { meta }),
    };
    // biome-ignore lint/suspicious/noConsole: Intentional stderr logging for MCP server
    console.error(JSON.stringify(logData));
  },
};

const builtIn = createBuiltInMiddleware();

const server = createMcpKitServer()
  .use(
    createErrorMapperMiddleware({
      enableLogging: true,
      debugMode: process.env.NODE_ENV === 'dev',
      includeStackTrace: process.env.NODE_ENV === 'dev',
      logLevel: 'info',
      logger: stderrLogger,
    })
  )
  .use(
    builtIn.logging({
      level: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
      includeRequest: process.env.NODE_ENV === 'dev',
      includeResponse: process.env.NODE_ENV === 'dev',
      logger: (level: string, message: string, data?: unknown) => {
        stderrLogger.log(level, message, data);
      },
    })
  )
  .tool('addNote', addNoteTool)
  .resource('notes://**', notesResource)
  .prompt('summarizeNote', summarizeNotePrompt)
  .transport(new StdioTransport())
  .listen();

process.on('SIGINT', () => {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  // biome-ignore lint/suspicious/noConsole: Demo script needs console output
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

export default server;
