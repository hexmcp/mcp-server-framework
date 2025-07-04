#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const Filename = fileURLToPath(import.meta.url);
const Dirname = dirname(Filename);

// Set working directory to the note-server directory
process.chdir(Dirname);

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Start the server using tsx
const serverPath = join(Dirname, 'src', 'note-server.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  cwd: Dirname,
  env: process.env,
});

// Handle process termination
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
