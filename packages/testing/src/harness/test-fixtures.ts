import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';

export const VALID_INITIALIZE_REQUEST_WITH_ID: InitializeRequest = {
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {
      experimental: {},
      sampling: {},
    },
    clientInfo: {
      name: 'Test Harness Client',
      version: '1.0.0',
    },
  },
};
