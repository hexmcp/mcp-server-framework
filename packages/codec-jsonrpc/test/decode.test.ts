import {
  decodeJsonRpcMessage,
  decodeJsonRpcNotification,
  decodeJsonRpcRequest,
} from "../src/decode";
import { JSON_RPC_ERROR_CODES, RpcError } from "../src/errors";

describe("decodeJsonRpcRequest", () => {
  describe("valid requests", () => {
    it("should decode valid request with string input", () => {
      const input = '{"jsonrpc":"2.0","id":1,"method":"test"}';
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      });
    });

    it("should decode valid request with object input", () => {
      const input = { jsonrpc: "2.0", id: "abc", method: "test" };
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual({
        jsonrpc: "2.0",
        id: "abc",
        method: "test",
      });
    });

    it("should decode request with params", () => {
      const input = {
        jsonrpc: "2.0",
        id: 1,
        method: "test",
        params: { arg1: "value1", arg2: 42 },
      };
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual(input);
    });

    it("should decode request with null id", () => {
      const input = { jsonrpc: "2.0", id: null, method: "test" };
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual(input);
    });

    it("should decode request with number id", () => {
      const input = { jsonrpc: "2.0", id: 123, method: "test" };
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual(input);
    });

    it("should decode request with array params", () => {
      const input = {
        jsonrpc: "2.0",
        id: 1,
        method: "test",
        params: [1, 2, 3],
      };
      const result = decodeJsonRpcRequest(input);

      expect(result).toEqual(input);
    });
  });

  describe("invalid requests", () => {
    it("should throw parse error for invalid JSON string", () => {
      const input = '{"jsonrpc":"2.0","id":1,"method":}';

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.PARSE_ERROR,
        })
      );
    });

    it("should throw invalid request for non-object input", () => {
      expect(() => decodeJsonRpcRequest(123)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(123)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for array input", () => {
      const input = [{ jsonrpc: "2.0", id: 1, method: "test" }];

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for null input", () => {
      expect(() => decodeJsonRpcRequest(null)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(null)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for missing jsonrpc", () => {
      const input = { id: 1, method: "test" };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for wrong jsonrpc version", () => {
      const input = { jsonrpc: "1.0", id: 1, method: "test" };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for missing method", () => {
      const input = { jsonrpc: "2.0", id: 1 };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for empty method", () => {
      const input = { jsonrpc: "2.0", id: 1, method: "" };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for non-string method", () => {
      const input = { jsonrpc: "2.0", id: 1, method: 123 };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });

    it("should throw invalid request for invalid id type", () => {
      const input = { jsonrpc: "2.0", id: {}, method: "test" };

      expect(() => decodeJsonRpcRequest(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcRequest(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });
  });
});

describe("decodeJsonRpcNotification", () => {
  describe("valid notifications", () => {
    it("should decode valid notification", () => {
      const input = { jsonrpc: "2.0", method: "notify" };
      const result = decodeJsonRpcNotification(input);

      expect(result).toEqual({
        jsonrpc: "2.0",
        method: "notify",
      });
    });

    it("should decode notification with params", () => {
      const input = {
        jsonrpc: "2.0",
        method: "notify",
        params: { data: "test" },
      };
      const result = decodeJsonRpcNotification(input);

      expect(result).toEqual(input);
    });
  });

  describe("invalid notifications", () => {
    it("should throw invalid request for notification with id", () => {
      const input = { jsonrpc: "2.0", id: 1, method: "notify" };

      expect(() => decodeJsonRpcNotification(input)).toThrow(RpcError);
      expect(() => decodeJsonRpcNotification(input)).toThrow(
        expect.objectContaining({
          code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        })
      );
    });
  });
});

describe("decodeJsonRpcMessage", () => {
  it("should decode request message", () => {
    const input = { jsonrpc: "2.0", id: 1, method: "test" };
    const result = decodeJsonRpcMessage(input);

    expect(result).toEqual(input);
    expect("id" in result).toBe(true);
  });

  it("should decode notification message", () => {
    const input = { jsonrpc: "2.0", method: "notify" };
    const result = decodeJsonRpcMessage(input);

    expect(result).toEqual(input);
    expect("id" in result).toBe(false);
  });
});
