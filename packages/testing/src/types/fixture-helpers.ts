import { COMMON_ERROR_CODES, DEFAULT_FIXTURE_VERSION, DEFAULT_TIMEOUT } from './fixture-constants.js';
import type { FixtureCategory, FixtureDefinition, FixtureExpected, FixtureInput, FixtureMetadata } from './fixture-types.js';

export interface CreateFixtureOptions {
  name: string;
  description: string;
  category: FixtureCategory;
  input: FixtureInput;
  expected: FixtureExpected;
  metadata?: FixtureMetadata;
  version?: string;
  tags?: string[];
}

export function createFixture(options: CreateFixtureOptions): FixtureDefinition {
  const fixture: FixtureDefinition = {
    name: options.name,
    description: options.description,
    category: options.category,
    input: options.input,
    expected: options.expected,
    version: options.version || DEFAULT_FIXTURE_VERSION,
  };

  if (options.metadata !== undefined) {
    fixture.metadata = options.metadata;
  }

  if (options.tags !== undefined) {
    fixture.tags = options.tags;
  }

  return fixture;
}

export function createSuccessFixture(
  name: string,
  description: string,
  category: FixtureCategory,
  method: string,
  params: unknown,
  result: unknown,
  metadata?: FixtureMetadata
): FixtureDefinition {
  const options: CreateFixtureOptions = {
    name,
    description,
    category,
    input: {
      jsonrpc: '2.0',
      id: `test-${name}`,
      method,
      params,
    },
    expected: {
      type: 'success',
      response: {
        jsonrpc: '2.0',
        id: `test-${name}`,
        result,
      },
    },
  };

  if (metadata !== undefined) {
    options.metadata = metadata;
  }

  return createFixture(options);
}

export function createErrorFixture(
  name: string,
  description: string,
  category: FixtureCategory,
  method: string,
  params: unknown,
  errorCode: number,
  errorMessage: string,
  errorData?: unknown,
  metadata?: FixtureMetadata
): FixtureDefinition {
  const options: CreateFixtureOptions = {
    name,
    description,
    category,
    input: {
      jsonrpc: '2.0',
      id: `test-${name}`,
      method,
      params,
    },
    expected: {
      type: 'error',
      error: {
        jsonrpc: '2.0',
        id: `test-${name}`,
        error: {
          code: errorCode,
          message: errorMessage,
          data: errorData,
        },
      },
    },
  };

  if (metadata !== undefined) {
    options.metadata = metadata;
  }

  return createFixture(options);
}

export function createNotificationFixture(
  name: string,
  description: string,
  category: FixtureCategory,
  method: string,
  params: unknown,
  metadata?: FixtureMetadata
): FixtureDefinition {
  const options: CreateFixtureOptions = {
    name,
    description,
    category,
    input: {
      jsonrpc: '2.0',
      id: null,
      method,
      params,
    },
    expected: {
      type: 'notification',
    },
  };

  if (metadata !== undefined) {
    options.metadata = metadata;
  }

  return createFixture(options);
}

export function createStreamFixture(
  name: string,
  description: string,
  category: FixtureCategory,
  method: string,
  params: unknown,
  chunks: unknown[],
  metadata?: FixtureMetadata
): FixtureDefinition {
  const options: CreateFixtureOptions = {
    name,
    description,
    category,
    input: {
      jsonrpc: '2.0',
      id: `test-${name}`,
      method,
      params,
    },
    expected: {
      type: 'stream',
      stream: {
        chunks,
        complete: true,
      },
      timeout: metadata?.timeout || DEFAULT_TIMEOUT * 2,
    },
  };

  if (metadata !== undefined) {
    options.metadata = metadata;
  }

  return createFixture(options);
}

export function createMethodNotFoundFixture(name: string, method: string, params?: unknown): FixtureDefinition {
  return createErrorFixture(
    name,
    `Method '${method}' not found`,
    'errors' as FixtureCategory,
    method,
    params,
    COMMON_ERROR_CODES.METHOD_NOT_FOUND,
    'Method not found',
    { method }
  );
}

export function createInvalidParamsFixture(name: string, method: string, params: unknown, reason?: string): FixtureDefinition {
  return createErrorFixture(
    name,
    `Invalid parameters for '${method}'${reason ? `: ${reason}` : ''}`,
    'errors' as FixtureCategory,
    method,
    params,
    COMMON_ERROR_CODES.INVALID_PARAMS,
    'Invalid params',
    { reason }
  );
}

export function createAuthRequiredFixture(name: string, method: string, params?: unknown): FixtureDefinition {
  return createErrorFixture(
    name,
    `Authentication required for '${method}'`,
    'auth' as FixtureCategory,
    method,
    params,
    COMMON_ERROR_CODES.AUTHENTICATION_FAILED,
    'Authentication required',
    undefined,
    { requiresAuth: true }
  );
}
