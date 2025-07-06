#!/usr/bin/env node

import {
  createBuiltInMiddleware,
  createErrorMapperMiddleware,
  createMcpKitServer,
  createSilentLogger,
  createStderrLogger,
  createStreamingInfoMiddleware,
} from '@hexmcp/core';
import { summarizeNotePrompt } from './handlers/prompts.js';
import { notesResource } from './handlers/resources.js';
import { addNoteTool } from './handlers/tools.js';

const builtIn = createBuiltInMiddleware();

const isSilentMode = process.env.MCPKIT_SILENT === 'true' || process.env.LOG_LEVEL === 'silent';
const isDevMode = process.env.NODE_ENV === 'dev';

const silentLogger = (_level: string, _message: string, _data?: unknown) => {
  // Silent logger - discard all output
};

const logLevel = process.env.LOG_LEVEL === 'debug' ? 'debug' : 'error';

const loggingConfig = isSilentMode
  ? {
      level: 'error' as const,
      includeRequest: false,
      includeResponse: false,
      logger: silentLogger,
    }
  : {
      level: logLevel as 'debug' | 'error',
      includeRequest: isDevMode,
      includeResponse: isDevMode,
    };

const server = createMcpKitServer()
  .use(createStreamingInfoMiddleware())
  .use(
    createErrorMapperMiddleware({
      enableLogging: !isSilentMode,
      debugMode: isDevMode,
      includeStackTrace: isDevMode,
      logLevel: isSilentMode ? 'error' : 'info',
      logger: isSilentMode ? createSilentLogger() : createStderrLogger(),
    })
  )
  .use(builtIn.logging(loggingConfig))
  .tool('addNote', addNoteTool)
  .resource('notes://', notesResource)
  .resource('notes://*', notesResource)
  .prompt('summarizeNote', summarizeNotePrompt)
  .listen();

process.on('SIGINT', () => {
  if (!isSilentMode) {
    // biome-ignore lint/suspicious/noConsole: Stderr logging for graceful shutdown
    console.error('Received SIGINT, shutting down gracefully...');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (!isSilentMode) {
    // biome-ignore lint/suspicious/noConsole: Stderr logging for graceful shutdown
    console.error('Received SIGTERM, shutting down gracefully...');
  }
  process.exit(0);
});

export default server;
