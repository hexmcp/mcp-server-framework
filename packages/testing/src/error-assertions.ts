import type { JsonRpcError, JsonRpcResponse } from './types';

/**
 * Standard JSON-RPC error codes as defined by the specification.
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP-specific error codes
  MCP_PRE_INITIALIZATION: -32002,
  MCP_POST_SHUTDOWN: -32003,

  // Server error range
  SERVER_ERROR_MIN: -32099,
  SERVER_ERROR_MAX: -32000,
} as const;

/**
 * Type for JSON-RPC error codes.
 */
export type JsonRpcErrorCode = (typeof JsonRpcErrorCodes)[keyof typeof JsonRpcErrorCodes];

/**
 * Asserts that a response contains an error with the specified code.
 */
export function expectErrorCode(response: JsonRpcResponse, expectedCode: number): void {
  if (!response.error) {
    throw new Error(`Expected response to contain an error, but got result: ${JSON.stringify(response.result)}`);
  }

  if (response.error.code !== expectedCode) {
    throw new Error(`Expected error code ${expectedCode}, but got ${response.error.code}. Error: ${response.error.message}`);
  }
}

/**
 * Asserts that a response contains an error with a message matching the pattern.
 */
export function expectErrorMessage(response: JsonRpcResponse, messagePattern: string | RegExp): void {
  if (!response.error) {
    throw new Error(`Expected response to contain an error, but got result: ${JSON.stringify(response.result)}`);
  }

  const message = response.error.message;
  if (typeof messagePattern === 'string') {
    if (!message.includes(messagePattern)) {
      throw new Error(`Expected error message to contain "${messagePattern}", but got: "${message}"`);
    }
  } else if (!messagePattern.test(message)) {
    throw new Error(`Expected error message to match pattern ${messagePattern}, but got: "${message}"`);
  }
}

/**
 * Asserts that a response contains a specific JSON-RPC error.
 */
export function expectJsonRpcError(response: JsonRpcResponse, code: number, messagePattern?: string | RegExp): void {
  expectErrorCode(response, code);
  if (messagePattern) {
    expectErrorMessage(response, messagePattern);
  }
}

/**
 * Asserts that a response contains a parse error (-32700).
 */
export function expectParseError(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.PARSE_ERROR, messagePattern);
}

/**
 * Asserts that a response contains an invalid request error (-32600).
 */
export function expectInvalidRequest(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.INVALID_REQUEST, messagePattern);
}

/**
 * Asserts that a response contains a method not found error (-32601).
 */
export function expectMethodNotFound(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.METHOD_NOT_FOUND, messagePattern);
}

/**
 * Asserts that a response contains an invalid params error (-32602).
 */
export function expectInvalidParams(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.INVALID_PARAMS, messagePattern);
}

/**
 * Asserts that a response contains an internal error (-32603).
 */
export function expectInternalError(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.INTERNAL_ERROR, messagePattern);
}

/**
 * Asserts that a response contains an MCP pre-initialization error (-32002).
 */
export function expectMcpPreInitializationError(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.MCP_PRE_INITIALIZATION, messagePattern);
}

/**
 * Asserts that a response contains an MCP post-shutdown error (-32003).
 */
export function expectMcpPostShutdownError(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  expectJsonRpcError(response, JsonRpcErrorCodes.MCP_POST_SHUTDOWN, messagePattern);
}

/**
 * Asserts that a response contains a server error (in the -32099 to -32000 range).
 */
export function expectServerError(response: JsonRpcResponse, messagePattern?: string | RegExp): void {
  if (!response.error) {
    throw new Error(`Expected response to contain an error, but got result: ${JSON.stringify(response.result)}`);
  }

  const code = response.error.code;
  if (code < JsonRpcErrorCodes.SERVER_ERROR_MIN || code > JsonRpcErrorCodes.SERVER_ERROR_MAX) {
    throw new Error(
      `Expected server error code (${JsonRpcErrorCodes.SERVER_ERROR_MIN} to ${JsonRpcErrorCodes.SERVER_ERROR_MAX}), but got ${code}`
    );
  }

  if (messagePattern) {
    expectErrorMessage(response, messagePattern);
  }
}

/**
 * Asserts that a response does not contain an error.
 */
export function expectNoError(response: JsonRpcResponse): void {
  if (response.error) {
    throw new Error(`Expected response to not contain an error, but got: ${JSON.stringify(response.error)}`);
  }
}

/**
 * Asserts that a response contains a successful result.
 */
export function expectSuccess(response: JsonRpcResponse): void {
  expectNoError(response);
  if (response.result === undefined) {
    throw new Error('Expected response to contain a result, but result was undefined');
  }
}

/**
 * Asserts that an error object has the expected structure.
 */
export function expectValidErrorStructure(error: JsonRpcError): void {
  if (typeof error.code !== 'number') {
    throw new Error(`Expected error code to be a number, but got ${typeof error.code}: ${error.code}`);
  }

  if (typeof error.message !== 'string') {
    throw new Error(`Expected error message to be a string, but got ${typeof error.message}: ${error.message}`);
  }

  if (error.message.length === 0) {
    throw new Error('Expected error message to be non-empty');
  }
}

/**
 * Creates a custom error assertion function for specific error patterns.
 */
export function createCustomAssertion(name: string, code: number, messagePattern?: string | RegExp): (response: JsonRpcResponse) => void {
  return (response: JsonRpcResponse) => {
    try {
      expectJsonRpcError(response, code, messagePattern);
    } catch (error) {
      throw new Error(`${name} assertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

/**
 * Enhanced error assertion utilities for testing JSON-RPC responses.
 * @deprecated Use individual functions instead
 */
export const ErrorAssertions = {
  expectErrorCode,
  expectErrorMessage,
  expectJsonRpcError,
  expectParseError,
  expectInvalidRequest,
  expectMethodNotFound,
  expectInvalidParams,
  expectInternalError,
  expectMcpPreInitializationError,
  expectMcpPostShutdownError,
  expectServerError,
  expectNoError,
  expectSuccess,
  expectValidErrorStructure,
  createCustomAssertion,
};

/**
 * Utility functions for working with error responses in tests.
 */
export const ErrorTestUtils = {
  /**
   * Creates a JSON-RPC error response for testing.
   */
  createErrorResponse: (id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  }),

  /**
   * Creates a JSON-RPC success response for testing.
   */
  createSuccessResponse: (id: string | number | null, result: unknown): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    result,
  }),

  /**
   * Extracts error information from a response for easier testing.
   */
  extractError: (response: JsonRpcResponse): JsonRpcError | null => response.error || null,

  /**
   * Checks if a response represents a specific error type.
   */
  isErrorType: (response: JsonRpcResponse, code: number): boolean => {
    return response.error?.code === code;
  },

  /**
   * Checks if a response represents any error.
   */
  isError: (response: JsonRpcResponse): boolean => {
    return !!response.error;
  },

  /**
   * Checks if a response represents a successful result.
   */
  isSuccess: (response: JsonRpcResponse): boolean => {
    return !response.error && response.result !== undefined;
  },

  /**
   * Validates that an error response follows JSON-RPC 2.0 specification.
   */
  validateErrorResponse: (response: JsonRpcResponse): boolean => {
    try {
      if (response.jsonrpc !== '2.0') {
        return false;
      }
      if (!response.error) {
        return false;
      }
      if (typeof response.error.code !== 'number') {
        return false;
      }
      if (typeof response.error.message !== 'string') {
        return false;
      }
      if (response.result !== undefined) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validates that a success response follows JSON-RPC 2.0 specification.
   */
  validateSuccessResponse: (response: JsonRpcResponse): boolean => {
    try {
      if (response.jsonrpc !== '2.0') {
        return false;
      }
      if (response.error !== undefined) {
        return false;
      }
      if (response.result === undefined) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Jest-style matchers for error assertions (can be used with expect.extend).
 */
export const ErrorMatchers = {
  toHaveErrorCode: (received: JsonRpcResponse, expectedCode: number) => {
    const pass = received.error?.code === expectedCode;
    return {
      pass,
      message: () =>
        pass
          ? `Expected response not to have error code ${expectedCode}`
          : `Expected response to have error code ${expectedCode}, but got ${received.error?.code || 'no error'}`,
    };
  },

  toHaveErrorMessage: (received: JsonRpcResponse, expectedMessage: string | RegExp) => {
    const message = received.error?.message;
    const pass = typeof expectedMessage === 'string' ? message?.includes(expectedMessage) || false : expectedMessage.test(message || '');

    return {
      pass,
      message: () =>
        pass
          ? `Expected response not to have error message matching ${expectedMessage}`
          : `Expected response to have error message matching ${expectedMessage}, but got "${message || 'no error'}"`,
    };
  },

  toBeJsonRpcError: (received: JsonRpcResponse) => {
    const pass = ErrorTestUtils.validateErrorResponse(received);
    return {
      pass,
      message: () => (pass ? 'Expected response not to be a valid JSON-RPC error' : 'Expected response to be a valid JSON-RPC error'),
    };
  },

  toBeJsonRpcSuccess: (received: JsonRpcResponse) => {
    const pass = ErrorTestUtils.validateSuccessResponse(received);
    return {
      pass,
      message: () => (pass ? 'Expected response not to be a valid JSON-RPC success' : 'Expected response to be a valid JSON-RPC success'),
    };
  },
};
