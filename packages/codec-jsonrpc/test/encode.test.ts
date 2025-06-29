import {
  encodeJsonRpcError,
  encodeJsonRpcErrorFromPlain,
  encodeJsonRpcInternalError,
  encodeJsonRpcInvalidParams,
  encodeJsonRpcInvalidRequest,
  encodeJsonRpcMethodNotFound,
  encodeJsonRpcParseError,
  encodeJsonRpcSuccess,
} from "../src/encode";
import { JSON_RPC_ERROR_CODES, RpcError } from "../src/errors";

describe("encodeJsonRpcSuccess", () => {
  it("should encode success response with string id", () => {
    const result = encodeJsonRpcSuccess("test-id", { data: "success" });

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "test-id",
      result: { data: "success" },
    });
  });

  it("should encode success response with number id", () => {
    const result = encodeJsonRpcSuccess(123, "simple result");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: 123,
      result: "simple result",
    });
  });

  it("should encode success response with null id", () => {
    const result = encodeJsonRpcSuccess(null, [1, 2, 3]);

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: null,
      result: [1, 2, 3],
    });
  });

  it("should encode success response with complex result", () => {
    const complexResult = {
      users: [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ],
      meta: { total: 2, page: 1 },
    };
    const result = encodeJsonRpcSuccess("query-123", complexResult);

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "query-123",
      result: complexResult,
    });
  });
});

describe("encodeJsonRpcError", () => {
  it("should encode error response from RpcError", () => {
    const error = new RpcError(1001, "Custom error", { extra: "data" });
    const result = encodeJsonRpcError("error-id", error);

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "error-id",
      error: {
        code: 1001,
        message: "Custom error",
        data: { extra: "data" },
      },
    });
  });

  it("should encode error response without data", () => {
    const error = new RpcError(2002, "Simple error");
    const result = encodeJsonRpcError(456, error);

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: 456,
      error: {
        code: 2002,
        message: "Simple error",
      },
    });
  });

  it("should encode error response with null id", () => {
    const error = RpcError.parseError();
    const result = encodeJsonRpcError(null, error);

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: JSON_RPC_ERROR_CODES.PARSE_ERROR,
        message: "Parse error",
      },
    });
  });
});

describe("encodeJsonRpcErrorFromPlain", () => {
  it("should encode error from plain values with data", () => {
    const result = encodeJsonRpcErrorFromPlain("plain-id", 3003, "Plain error", {
      context: "test",
    });

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "plain-id",
      error: {
        code: 3003,
        message: "Plain error",
        data: { context: "test" },
      },
    });
  });

  it("should encode error from plain values without data", () => {
    const result = encodeJsonRpcErrorFromPlain("plain-id", 4004, "No data error");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "plain-id",
      error: {
        code: 4004,
        message: "No data error",
      },
    });
  });
});

describe("convenience error encoders", () => {
  it("should encode parse error", () => {
    const result = encodeJsonRpcParseError("parse-id");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "parse-id",
      error: {
        code: JSON_RPC_ERROR_CODES.PARSE_ERROR,
        message: "Parse error",
      },
    });
  });

  it("should encode parse error with default null id", () => {
    const result = encodeJsonRpcParseError();

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: JSON_RPC_ERROR_CODES.PARSE_ERROR,
        message: "Parse error",
      },
    });
  });

  it("should encode invalid request error", () => {
    const result = encodeJsonRpcInvalidRequest("invalid-id");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "invalid-id",
      error: {
        code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        message: "Invalid Request",
      },
    });
  });

  it("should encode method not found error", () => {
    const result = encodeJsonRpcMethodNotFound("method-id", "unknownMethod");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "method-id",
      error: {
        code: JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
        message: "Method not found: unknownMethod",
      },
    });
  });

  it("should encode invalid params error", () => {
    const result = encodeJsonRpcInvalidParams("params-id");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "params-id",
      error: {
        code: JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        message: "Invalid params",
      },
    });
  });

  it("should encode internal error", () => {
    const result = encodeJsonRpcInternalError("internal-id");

    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "internal-id",
      error: {
        code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        message: "Internal error",
      },
    });
  });
});
