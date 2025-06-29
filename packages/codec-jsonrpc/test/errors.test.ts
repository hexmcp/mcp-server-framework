import { JSON_RPC_ERROR_CODES, RpcError } from "../src/errors";

describe("RpcError", () => {
  describe("constructor", () => {
    it("should create error with code, message, and data", () => {
      const error = new RpcError(123, "Test error", { extra: "data" });

      expect(error.code).toBe(123);
      expect(error.message).toBe("Test error");
      expect(error.data).toEqual({ extra: "data" });
      expect(error.name).toBe("RpcError");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create error without data", () => {
      const error = new RpcError(456, "Another error");

      expect(error.code).toBe(456);
      expect(error.message).toBe("Another error");
      expect(error.data).toBeUndefined();
    });

    it("should have proper debug stack trace", () => {
      const error = new RpcError(789, "Stack test");
      expect(error.debugStack).toBeDefined();
      expect(error.debugStack).toContain("RpcError");
    });
  });

  describe("factory methods", () => {
    it("should create parse error", () => {
      const error = RpcError.parseError();

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.PARSE_ERROR);
      expect(error.message).toBe("Parse error");
      expect(error.data).toBeUndefined();
    });

    it("should create parse error with data", () => {
      const data = { line: 5, column: 10 };
      const error = RpcError.parseError(data);

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.PARSE_ERROR);
      expect(error.message).toBe("Parse error");
      expect(error.data).toEqual(data);
    });

    it("should create invalid request error", () => {
      const error = RpcError.invalidRequest();

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST);
      expect(error.message).toBe("Invalid Request");
      expect(error.data).toBeUndefined();
    });

    it("should create method not found error", () => {
      const error = RpcError.methodNotFound("testMethod");

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND);
      expect(error.message).toBe("Method not found: testMethod");
      expect(error.data).toBeUndefined();
    });

    it("should create method not found error with data", () => {
      const data = { availableMethods: ["method1", "method2"] };
      const error = RpcError.methodNotFound("unknownMethod", data);

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND);
      expect(error.message).toBe("Method not found: unknownMethod");
      expect(error.data).toEqual(data);
    });

    it("should create invalid params error", () => {
      const error = RpcError.invalidParams();

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(error.message).toBe("Invalid params");
      expect(error.data).toBeUndefined();
    });

    it("should create internal error", () => {
      const error = RpcError.internalError();

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(error.message).toBe("Internal error");
      expect(error.data).toBeUndefined();
    });

    it("should create custom error", () => {
      const error = RpcError.custom(1001, "Custom error message", { custom: true });

      expect(error.code).toBe(1001);
      expect(error.message).toBe("Custom error message");
      expect(error.data).toEqual({ custom: true });
    });
  });

  describe("toJSON", () => {
    it("should serialize error without data", () => {
      const error = RpcError.parseError();
      const json = error.toJSON();

      expect(json).toEqual({
        code: JSON_RPC_ERROR_CODES.PARSE_ERROR,
        message: "Parse error",
      });
    });

    it("should serialize error with data", () => {
      const data = { details: "test" };
      const error = RpcError.invalidRequest(data);
      const json = error.toJSON();

      expect(json).toEqual({
        code: JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        message: "Invalid Request",
        data,
      });
    });

    it("should not include data field when data is undefined", () => {
      const error = new RpcError(123, "Test", undefined);
      const json = error.toJSON();

      expect(json).toEqual({
        code: 123,
        message: "Test",
      });
      expect("data" in json).toBe(false);
    });
  });

  describe("debug masking", () => {
    const originalEnv = process.env.MCPKIT_DEBUG;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.MCPKIT_DEBUG = originalEnv;
      } else {
        delete process.env.MCPKIT_DEBUG;
      }
    });

    it("should mask stack traces when debug mode is disabled", () => {
      delete process.env.MCPKIT_DEBUG;
      const error = new RpcError(123, "Test error");

      expect(error.stack).toBeUndefined();
      expect(error.debugStack).toBeDefined();
      expect(error.debugStack).toContain("RpcError");
    });

    it("should preserve stack traces when debug mode is enabled", () => {
      process.env.MCPKIT_DEBUG = "1";
      const error = new RpcError(123, "Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("RpcError");
      expect(error.debugStack).toBeDefined();
      expect(error.debugStack).toBe(error.stack);
    });

    it("should not include stack in JSON when debug mode is disabled", () => {
      delete process.env.MCPKIT_DEBUG;
      const error = new RpcError(123, "Test error", { extra: "data" });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 123,
        message: "Test error",
        data: { extra: "data" },
      });
      expect("stack" in json).toBe(false);
    });

    it("should include stack in JSON when debug mode is enabled", () => {
      process.env.MCPKIT_DEBUG = "1";
      const error = new RpcError(123, "Test error");
      const json = error.toJSON();

      expect(json.code).toBe(123);
      expect(json.message).toBe("Test error");
      expect(json.stack).toBeDefined();
      expect(json.stack).toContain("RpcError");
    });

    it("should handle factory methods with debug masking", () => {
      delete process.env.MCPKIT_DEBUG;
      const error = RpcError.parseError({ details: "test" });

      expect(error.stack).toBeUndefined();
      expect(error.debugStack).toBeDefined();

      const json = error.toJSON();
      expect("stack" in json).toBe(false);
    });
  });

  describe("JSON_RPC_ERROR_CODES", () => {
    it("should have correct standard error codes", () => {
      expect(JSON_RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700);
      expect(JSON_RPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
      expect(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
      expect(JSON_RPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
      expect(JSON_RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
    });
  });
});
