import {
  createCustomAssertion,
  ErrorTestUtils,
  expectErrorCode,
  expectErrorMessage,
  expectInternalError,
  expectInvalidParams,
  expectInvalidRequest,
  expectMcpPostShutdownError,
  expectMcpPreInitializationError,
  expectMethodNotFound,
  expectNoError,
  expectParseError,
  expectServerError,
  expectSuccess,
  JsonRpcErrorCodes,
} from '../src/error-assertions';
import type { JsonRpcResponse } from '../src/types';

describe('Error Assertions', () => {
  describe('ErrorAssertions', () => {
    describe('expectErrorCode', () => {
      it('should pass for correct error code', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        expect(() => {
          expectErrorCode(response, -32602);
        }).not.toThrow();
      });

      it('should throw for incorrect error code', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        };

        expect(() => {
          expectErrorCode(response, -32602);
        }).toThrow('Expected error code -32602, but got -32601');
      });

      it('should throw for success response', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        };

        expect(() => {
          expectErrorCode(response, -32602);
        }).toThrow('Expected response to contain an error');
      });
    });

    describe('expectErrorMessage', () => {
      it('should pass for string pattern match', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params: missing required field' },
        };

        expect(() => {
          expectErrorMessage(response, 'Invalid params');
        }).not.toThrow();
      });

      it('should pass for regex pattern match', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params: field123 is required' },
        };

        expect(() => {
          expectErrorMessage(response, /field\d+ is required/);
        }).not.toThrow();
      });

      it('should throw for non-matching string pattern', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Method not found' },
        };

        expect(() => {
          expectErrorMessage(response, 'Invalid params');
        }).toThrow('Expected error message to contain "Invalid params"');
      });

      it('should throw for non-matching regex pattern', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Method not found' },
        };

        expect(() => {
          expectErrorMessage(response, /field\d+ is required/);
        }).toThrow('Expected error message to match pattern');
      });
    });

    describe('specific error type assertions', () => {
      it('should validate parse error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: JsonRpcErrorCodes.PARSE_ERROR, message: 'Parse error' },
        };

        expect(() => {
          expectParseError(response);
        }).not.toThrow();
      });

      it('should validate invalid request error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: JsonRpcErrorCodes.INVALID_REQUEST, message: 'Invalid Request' },
        };

        expect(() => {
          expectInvalidRequest(response);
        }).not.toThrow();
      });

      it('should validate method not found error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: JsonRpcErrorCodes.METHOD_NOT_FOUND, message: 'Method not found' },
        };

        expect(() => {
          expectMethodNotFound(response);
        }).not.toThrow();
      });

      it('should validate invalid params error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: JsonRpcErrorCodes.INVALID_PARAMS, message: 'Invalid params' },
        };

        expect(() => {
          expectInvalidParams(response);
        }).not.toThrow();
      });

      it('should validate internal error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: JsonRpcErrorCodes.INTERNAL_ERROR, message: 'Internal error' },
        };

        expect(() => {
          expectInternalError(response);
        }).not.toThrow();
      });

      it('should validate MCP pre-initialization error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: JsonRpcErrorCodes.MCP_PRE_INITIALIZATION, message: 'Server not initialized' },
        };

        expect(() => {
          expectMcpPreInitializationError(response);
        }).not.toThrow();
      });

      it('should validate MCP post-shutdown error', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: JsonRpcErrorCodes.MCP_POST_SHUTDOWN, message: 'Server has shut down' },
        };

        expect(() => {
          expectMcpPostShutdownError(response);
        }).not.toThrow();
      });
    });

    describe('expectServerError', () => {
      it('should pass for server error codes', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32050, message: 'Server error' },
        };

        expect(() => {
          expectServerError(response);
        }).not.toThrow();
      });

      it('should throw for non-server error codes', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        expect(() => {
          expectServerError(response);
        }).toThrow('Expected server error code');
      });
    });

    describe('expectNoError', () => {
      it('should pass for success response', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        };

        expect(() => {
          expectNoError(response);
        }).not.toThrow();
      });

      it('should throw for error response', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        expect(() => {
          expectNoError(response);
        }).toThrow('Expected response to not contain an error');
      });
    });

    describe('expectSuccess', () => {
      it('should pass for success response with result', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
        };

        expect(() => {
          expectSuccess(response);
        }).not.toThrow();
      });

      it('should throw for error response', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        expect(() => {
          expectSuccess(response);
        }).toThrow('Expected response to not contain an error');
      });

      it('should throw for response without result', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
        };

        expect(() => {
          expectSuccess(response);
        }).toThrow('Expected response to contain a result');
      });
    });

    describe('createCustomAssertion', () => {
      it('should create custom assertion function', () => {
        const expectCustomError = createCustomAssertion('Custom Error', -32001, 'Custom message');

        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32001, message: 'Custom message here' },
        };

        expect(() => {
          expectCustomError(response);
        }).not.toThrow();
      });

      it('should throw with custom name in error message', () => {
        const expectCustomError = createCustomAssertion('Custom Error', -32001, 'Custom message');

        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32002, message: 'Different message' },
        };

        expect(() => {
          expectCustomError(response);
        }).toThrow('Custom Error assertion failed');
      });
    });
  });

  describe('ErrorTestUtils', () => {
    describe('createErrorResponse', () => {
      it('should create valid error response', () => {
        const response = ErrorTestUtils.createErrorResponse(1, -32602, 'Invalid params');

        expect(response).toEqual({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        });
      });

      it('should create error response with data', () => {
        const response = ErrorTestUtils.createErrorResponse(1, -32602, 'Invalid params', { field: 'name' });

        expect(response.error?.data).toEqual({ field: 'name' });
      });
    });

    describe('createSuccessResponse', () => {
      it('should create valid success response', () => {
        const response = ErrorTestUtils.createSuccessResponse(1, { data: 'test' });

        expect(response).toEqual({
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
        });
      });
    });

    describe('utility functions', () => {
      it('should extract error from response', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        const error = ErrorTestUtils.extractError(response);
        expect(error).toEqual({ code: -32602, message: 'Invalid params' });
      });

      it('should check if response is error type', () => {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        expect(ErrorTestUtils.isErrorType(response, -32602)).toBe(true);
        expect(ErrorTestUtils.isErrorType(response, -32601)).toBe(false);
      });

      it('should check if response is error', () => {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        const successResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
        };

        expect(ErrorTestUtils.isError(errorResponse)).toBe(true);
        expect(ErrorTestUtils.isError(successResponse)).toBe(false);
      });

      it('should check if response is success', () => {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        const successResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
        };

        expect(ErrorTestUtils.isSuccess(errorResponse)).toBe(false);
        expect(ErrorTestUtils.isSuccess(successResponse)).toBe(true);
      });
    });

    describe('validation functions', () => {
      it('should validate error response structure', () => {
        const validError: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        };

        const invalidError: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
          result: { data: 'should not be here' },
        };

        expect(ErrorTestUtils.validateErrorResponse(validError)).toBe(true);
        expect(ErrorTestUtils.validateErrorResponse(invalidError)).toBe(false);
      });

      it('should validate success response structure', () => {
        const validSuccess: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
        };

        const invalidSuccess: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'test' },
          error: { code: -32602, message: 'should not be here' },
        };

        expect(ErrorTestUtils.validateSuccessResponse(validSuccess)).toBe(true);
        expect(ErrorTestUtils.validateSuccessResponse(invalidSuccess)).toBe(false);
      });
    });
  });
});
