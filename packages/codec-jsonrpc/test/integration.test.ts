import {
  decodeJsonRpcMessage,
  decodeJsonRpcNotification,
  decodeJsonRpcRequest,
  encodeJsonRpcError,
  encodeJsonRpcSuccess,
  isJsonRpcError,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcSuccess,
  JSON_RPC_ERROR_CODES,
  type JsonRpcError,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  RpcError,
} from '../src/index';

describe('Integration Tests', () => {
  describe('type guards', () => {
    it('should correctly identify JSON-RPC requests', () => {
      const request: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      expect(isJsonRpcRequest(request)).toBe(true);
      expect(isJsonRpcNotification(request)).toBe(false);
    });

    it('should correctly identify JSON-RPC notifications', () => {
      const notification: JsonRpcMessage = {
        jsonrpc: '2.0',
        method: 'notify',
      };

      expect(isJsonRpcRequest(notification)).toBe(false);
      expect(isJsonRpcNotification(notification)).toBe(true);
    });

    it('should correctly identify success responses', () => {
      const success: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: 'success',
      };

      expect(isJsonRpcSuccess(success)).toBe(true);
      expect(isJsonRpcError(success)).toBe(false);
    });

    it('should correctly identify error responses', () => {
      const error: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      };

      expect(isJsonRpcSuccess(error)).toBe(false);
      expect(isJsonRpcError(error)).toBe(true);
    });
  });

  describe('end-to-end workflow', () => {
    it('should handle complete request-response cycle', () => {
      const requestJson = '{"jsonrpc":"2.0","id":1,"method":"add","params":[1,2]}';

      const request = decodeJsonRpcRequest<number[]>(requestJson);
      expect(request.method).toBe('add');
      expect(request.params).toEqual([1, 2]);

      const params = request.params as [number, number];
      const result = params[0] + params[1];
      const response = encodeJsonRpcSuccess(request.id, result);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 3,
      });
    });

    it('should handle error workflow', () => {
      const invalidJson = '{"jsonrpc":"2.0","method":123}';

      try {
        decodeJsonRpcRequest(invalidJson);
        // biome-ignore lint/correctness/noUndeclaredVariables: Jest global
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcError);
        const rpcError = error as RpcError;

        const errorResponse = encodeJsonRpcError(null, rpcError);
        expect(errorResponse.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST);
      }
    });

    it('should handle notification workflow', () => {
      const notificationJson = '{"jsonrpc":"2.0","method":"log","params":{"level":"info","message":"test"}}';

      const notification = decodeJsonRpcNotification(notificationJson);
      expect(notification.method).toBe('log');
      expect(notification.params).toEqual({
        level: 'info',
        message: 'test',
      });
      expect('id' in notification).toBe(false);
    });

    it('should handle mixed message decoding', () => {
      const requestJson = '{"jsonrpc":"2.0","id":"req-1","method":"getData"}';
      const notificationJson = '{"jsonrpc":"2.0","method":"notify"}';

      const request = decodeJsonRpcMessage(requestJson);
      const notification = decodeJsonRpcMessage(notificationJson);

      expect(isJsonRpcRequest(request)).toBe(true);
      expect(isJsonRpcNotification(notification)).toBe(true);

      if (isJsonRpcRequest(request)) {
        expect(request.id).toBe('req-1');
      }

      if (isJsonRpcNotification(notification)) {
        expect(notification.method).toBe('notify');
      }
    });
  });

  describe('type safety', () => {
    it('should maintain type safety with generics', () => {
      interface AddParams {
        a: number;
        b: number;
      }

      interface AddResult {
        sum: number;
      }

      const request: JsonRpcRequest<AddParams> = {
        jsonrpc: '2.0',
        id: 1,
        method: 'add',
        params: { a: 5, b: 3 },
      };

      const params = request.params as AddParams;
      const result: AddResult = {
        sum: params.a + params.b,
      };

      const response: JsonRpcSuccess<AddResult> = encodeJsonRpcSuccess(request.id, result);

      expect(response.result.sum).toBe(8);
    });

    it('should work with explicit JsonRpcError type', () => {
      const errorResponse: JsonRpcError = {
        jsonrpc: '2.0',
        id: 'test-id',
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: 'unknownMethod' },
        },
      };

      expect(isJsonRpcError(errorResponse)).toBe(true);
      expect(isJsonRpcSuccess(errorResponse)).toBe(false);
      expect(errorResponse.error.code).toBe(-32601);
    });

    it('should work with explicit JsonRpcNotification type', () => {
      interface LogParams {
        level: string;
        message: string;
        timestamp: number;
      }

      const notification: JsonRpcNotification<LogParams> = {
        jsonrpc: '2.0',
        method: 'log',
        params: {
          level: 'info',
          message: 'System started',
          timestamp: Date.now(),
        },
      };

      expect(isJsonRpcNotification(notification)).toBe(true);
      expect(isJsonRpcRequest(notification)).toBe(false);
      expect(notification.method).toBe('log');
      expect(notification.params?.level).toBe('info');
    });

    it('should handle JsonRpcResponse union type correctly', () => {
      const successResponse: JsonRpcResponse<string> = {
        jsonrpc: '2.0',
        id: 1,
        result: 'success',
      };

      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32000,
          message: 'Server error',
        },
      };

      expect(isJsonRpcSuccess(successResponse)).toBe(true);
      expect(isJsonRpcError(errorResponse)).toBe(true);

      if (isJsonRpcSuccess(successResponse)) {
        expect(successResponse.result).toBe('success');
      }

      if (isJsonRpcError(errorResponse)) {
        expect(errorResponse.error.code).toBe(-32000);
      }
    });

    it('should handle JsonRpcMessage union type correctly', () => {
      const request: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'getData',
      };

      const notification: JsonRpcMessage = {
        jsonrpc: '2.0',
        method: 'notify',
      };

      expect(isJsonRpcRequest(request)).toBe(true);
      expect(isJsonRpcNotification(notification)).toBe(true);

      if (isJsonRpcRequest(request)) {
        expect(request.id).toBe('req-1');
      }

      if (isJsonRpcNotification(notification)) {
        expect(notification.method).toBe('notify');
      }
    });
  });
});
