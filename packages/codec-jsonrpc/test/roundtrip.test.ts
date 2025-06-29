import {
  decodeJsonRpcMessage,
  decodeJsonRpcNotification,
  decodeJsonRpcRequest,
  encodeJsonRpcError,
  encodeJsonRpcSuccess,
} from "../src";
import { RpcError } from "../src/errors";
import type {
  JsonRpcError,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcSuccess,
} from "../src/types";

describe("Round-trip tests", () => {
  describe("Request round-trip", () => {
    it("should preserve request with object params", () => {
      const originalRequest: JsonRpcRequest<{ a: number; b: string }> = {
        jsonrpc: "2.0",
        id: "test-123",
        method: "testMethod",
        params: { a: 42, b: "hello" },
      };

      const decoded = decodeJsonRpcRequest(originalRequest);
      expect(decoded).toEqual(originalRequest);
    });

    it("should preserve request with array params", () => {
      const originalRequest: JsonRpcRequest<[number, string, boolean]> = {
        jsonrpc: "2.0",
        id: 456,
        method: "arrayMethod",
        params: [1, "test", true],
      };

      const decoded = decodeJsonRpcRequest(originalRequest);
      expect(decoded).toEqual(originalRequest);
    });

    it("should preserve request without params", () => {
      const originalRequest: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: null,
        method: "noParamsMethod",
      };

      const decoded = decodeJsonRpcRequest(originalRequest);
      expect(decoded).toEqual(originalRequest);
    });

    it("should preserve request with complex nested params", () => {
      const originalRequest: JsonRpcRequest<{
        user: { id: number; name: string };
        settings: { theme: string; notifications: boolean };
        tags: string[];
      }> = {
        jsonrpc: "2.0",
        id: "complex-123",
        method: "updateUser",
        params: {
          user: { id: 1, name: "John Doe" },
          settings: { theme: "dark", notifications: true },
          tags: ["admin", "premium"],
        },
      };

      const decoded = decodeJsonRpcRequest(originalRequest);
      expect(decoded).toEqual(originalRequest);
    });
  });

  describe("Notification round-trip", () => {
    it("should preserve notification with object params", () => {
      const originalNotification: JsonRpcNotification<{ level: string; message: string }> = {
        jsonrpc: "2.0",
        method: "log",
        params: { level: "info", message: "System started" },
      };

      const decoded = decodeJsonRpcNotification(originalNotification);
      expect(decoded).toEqual(originalNotification);
    });

    it("should preserve notification with array params", () => {
      const originalNotification: JsonRpcNotification<[string, number]> = {
        jsonrpc: "2.0",
        method: "notify",
        params: ["event", 123],
      };

      const decoded = decodeJsonRpcNotification(originalNotification);
      expect(decoded).toEqual(originalNotification);
    });

    it("should preserve notification without params", () => {
      const originalNotification: JsonRpcNotification = {
        jsonrpc: "2.0",
        method: "ping",
      };

      const decoded = decodeJsonRpcNotification(originalNotification);
      expect(decoded).toEqual(originalNotification);
    });
  });

  describe("Success response round-trip", () => {
    it("should preserve success response with primitive result", () => {
      const id = "success-123";
      const result = "operation completed";

      const encoded = encodeJsonRpcSuccess(id, result);
      const expectedResponse: JsonRpcSuccess<string> = {
        jsonrpc: "2.0",
        id,
        result,
      };

      expect(encoded).toEqual(expectedResponse);
    });

    it("should preserve success response with object result", () => {
      const id = 789;
      const result = { status: "ok", data: { count: 42 } };

      const encoded = encodeJsonRpcSuccess(id, result);
      const expectedResponse: JsonRpcSuccess<typeof result> = {
        jsonrpc: "2.0",
        id,
        result,
      };

      expect(encoded).toEqual(expectedResponse);
    });

    it("should preserve success response with null result", () => {
      const id = "null-result";
      const result = null;

      const encoded = encodeJsonRpcSuccess(id, result);
      const expectedResponse: JsonRpcSuccess<null> = {
        jsonrpc: "2.0",
        id,
        result,
      };

      expect(encoded).toEqual(expectedResponse);
    });

    it("should preserve success response with array result", () => {
      const id = "array-result";
      const result = [1, 2, 3, { nested: true }];

      const encoded = encodeJsonRpcSuccess(id, result);
      const expectedResponse: JsonRpcSuccess<typeof result> = {
        jsonrpc: "2.0",
        id,
        result,
      };

      expect(encoded).toEqual(expectedResponse);
    });
  });

  describe("Error response round-trip", () => {
    it("should preserve error response without data", () => {
      const id = "error-123";
      const error = new RpcError(-32601, "Method not found");

      const encoded = encodeJsonRpcError(id, error);
      const expectedResponse: JsonRpcError = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Method not found",
        },
      };

      expect(encoded).toEqual(expectedResponse);
    });

    it("should preserve error response with data", () => {
      const id = "error-with-data";
      const errorData = { method: "unknownMethod", available: ["method1", "method2"] };
      const error = new RpcError(-32601, "Method not found", errorData);

      const encoded = encodeJsonRpcError(id, error);
      const expectedResponse: JsonRpcError = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Method not found",
          data: errorData,
        },
      };

      expect(encoded).toEqual(expectedResponse);
    });

    it("should preserve error response with null id", () => {
      const id = null;
      const error = new RpcError(-32700, "Parse error");

      const encoded = encodeJsonRpcError(id, error);
      const expectedResponse: JsonRpcError = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      };

      expect(encoded).toEqual(expectedResponse);
    });
  });

  describe("Message union round-trip", () => {
    it("should handle request through message decoder", () => {
      const originalRequest: JsonRpcRequest<{ value: number }> = {
        jsonrpc: "2.0",
        id: "msg-request",
        method: "getValue",
        params: { value: 100 },
      };

      const decoded = decodeJsonRpcMessage(originalRequest);
      expect(decoded).toEqual(originalRequest);
    });

    it("should handle notification through message decoder", () => {
      const originalNotification: JsonRpcNotification<{ event: string }> = {
        jsonrpc: "2.0",
        method: "eventOccurred",
        params: { event: "user_login" },
      };

      const decoded = decodeJsonRpcMessage(originalNotification);
      expect(decoded).toEqual(originalNotification);
    });
  });

  describe("JSON string round-trip", () => {
    it("should handle JSON string input for requests", () => {
      const originalRequest = {
        jsonrpc: "2.0",
        id: "json-string",
        method: "testMethod",
        params: { test: true },
      };

      const jsonString = JSON.stringify(originalRequest);
      const decoded = decodeJsonRpcRequest(jsonString);

      expect(decoded).toEqual(originalRequest);
    });

    it("should handle JSON string input for notifications", () => {
      const originalNotification = {
        jsonrpc: "2.0",
        method: "notify",
        params: ["arg1", "arg2"],
      };

      const jsonString = JSON.stringify(originalNotification);
      const decoded = decodeJsonRpcNotification(jsonString);

      expect(decoded).toEqual(originalNotification);
    });

    it("should handle JSON string input for messages", () => {
      const originalMessage = {
        jsonrpc: "2.0",
        id: "message-test",
        method: "testMethod",
      };

      const jsonString = JSON.stringify(originalMessage);
      const decoded = decodeJsonRpcMessage(jsonString);

      expect(decoded).toEqual(originalMessage);
    });
  });
});
