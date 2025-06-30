import { Readable } from "node:stream";
import { JSON_RPC_ERROR_CODES } from "@hexmcp/codec-jsonrpc";
import type { TransportDispatch } from "@hexmcp/transport";
import { StdioTransport } from "../src/stdio-transport";

describe("StdioTransport", () => {
  let transport: StdioTransport;
  let mockStdout: jest.SpyInstance;
  let mockStdin: Readable;
  let originalStdin: NodeJS.ReadableStream;

  beforeEach(() => {
    transport = new StdioTransport();
    mockStdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

    mockStdin = new Readable({
      read() {
        // Mock implementation - no-op
      },
    });

    originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      configurable: true,
    });
  });

  afterEach(async () => {
    await transport.stop();
    mockStdout.mockRestore();

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
  });

  describe("interface compliance", () => {
    it("should have correct name", () => {
      expect(transport.name).toBe("stdio");
    });

    it("should implement ServerTransport interface", () => {
      expect(typeof transport.start).toBe("function");
      expect(typeof transport.stop).toBe("function");
      expect(typeof transport.name).toBe("string");
    });
  });

  describe("lifecycle management", () => {
    it("should start successfully with dispatch function", async () => {
      const dispatch = jest.fn();

      await expect(transport.start(dispatch)).resolves.toBeUndefined();
    });

    it("should throw error when starting already started transport", async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);

      await expect(transport.start(dispatch)).rejects.toThrow("StdioTransport is already started");
    });

    it("should stop gracefully", async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it("should handle multiple stop calls without throwing", async () => {
      const dispatch = jest.fn();

      await transport.start(dispatch);
      await transport.stop();
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it("should handle stop before start", async () => {
      await expect(transport.stop()).resolves.toBeUndefined();
    });
  });

  describe("message processing", () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it("should process valid JSON-RPC request", async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test","params":{"foo":"bar"}}';

      await sendMessage(request);

      expect(dispatch).toHaveBeenCalledWith(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "test",
          params: { foo: "bar" },
        },
        expect.any(Function),
        {
          transport: {
            name: "stdio",
          },
        }
      );
    });

    it("should process valid JSON-RPC notification", async () => {
      const notification = '{"jsonrpc":"2.0","method":"notify","params":["hello"]}';

      await sendMessage(notification);

      expect(dispatch).toHaveBeenCalledWith(
        {
          jsonrpc: "2.0",
          method: "notify",
          params: ["hello"],
        },
        expect.any(Function),
        {
          transport: {
            name: "stdio",
          },
        }
      );
    });

    it("should handle invalid JSON with parse error response", async () => {
      const invalidJson = '{"jsonrpc":"2.0","id":1,"method":"test"';

      await sendMessage(invalidJson);

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"message":"Parse error"'));
    });

    it("should handle malformed JSON-RPC with parse error response", async () => {
      const malformed = '{"version":"1.0","id":1}';

      await sendMessage(malformed);

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
    });
  });

  describe("response handling", () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    it("should write response as NDJSON to stdout", async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      await sendMessage(request);

      const [, respond] = dispatch.mock.calls[0] as [
        unknown,
        (response: unknown) => Promise<void>,
        unknown,
      ];
      const response = { jsonrpc: "2.0", id: 1, result: "success" };

      respond(response);

      expect(mockStdout).toHaveBeenCalledWith('{"jsonrpc":"2.0","id":1,"result":"success"}\n');
    });

    it("should handle response serialization errors gracefully", async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      await sendMessage(request);

      const [, respond] = dispatch.mock.calls[0] as [
        unknown,
        (response: unknown) => Promise<void>,
        unknown,
      ];
      const circularResponse = {};
      (circularResponse as any).self = circularResponse;

      const initialCallCount = mockStdout.mock.calls.length;

      respond(circularResponse);

      // Should not write anything to stdout when serialization fails
      expect(mockStdout.mock.calls.length).toBe(initialCallCount);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };
  });

  describe("NDJSON protocol compliance", () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    const sendMultipleMessages = (messages: string[]): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        messages.forEach((msg) => mockStdin.push(`${msg}\n`));
        mockStdin.push(null);
      });
    };

    it("should process multiple NDJSON lines", async () => {
      const line1 = '{"jsonrpc":"2.0","id":1,"method":"first"}';
      const line2 = '{"jsonrpc":"2.0","id":2,"method":"second"}';

      await sendMultipleMessages([line1, line2]);

      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: 1, method: "first" }),
        expect.any(Function),
        expect.any(Object)
      );
      expect(dispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: 2, method: "second" }),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("should handle empty lines gracefully", async () => {
      await sendMessage("");

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith(expect.stringContaining('"code":-32700'));
    });

    it("should maintain line boundaries correctly", async () => {
      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';

      mockStdin.push(request.slice(0, 10));
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(dispatch).not.toHaveBeenCalled();

      await sendMessage(request.slice(10));
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error edge cases", () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it("should not process messages after stop", async () => {
      await transport.stop();

      const request = '{"jsonrpc":"2.0","id":1,"method":"test"}';
      await sendMessage(request);

      expect(dispatch).not.toHaveBeenCalled();
    });

    it("should handle stdin close event gracefully", async () => {
      mockStdin.emit("close");
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(transport.name).toBe("stdio");
    });
  });

  describe("parse error responses", () => {
    let dispatch: jest.MockedFunction<TransportDispatch>;

    beforeEach(async () => {
      dispatch = jest.fn();
      await transport.start(dispatch);
    });

    const sendMessage = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), 10);
        mockStdin.push(`${message}\n`);
        mockStdin.push(null);
      });
    };

    it("should return parse error with null id for invalid JSON", async () => {
      await sendMessage("invalid json");

      expect(mockStdout).toHaveBeenCalledWith(
        expect.stringMatching(/"jsonrpc":"2\.0".*"id":null.*"error".*"code":-32700/)
      );
    });

    it("should return parse error for empty string", async () => {
      await sendMessage("");

      expect(mockStdout).toHaveBeenCalledWith(
        expect.stringContaining(`"code":${JSON_RPC_ERROR_CODES.PARSE_ERROR}`)
      );
    });

    it("should return parse error for non-object JSON", async () => {
      await sendMessage("42");

      expect(mockStdout).toHaveBeenCalledWith(
        expect.stringContaining(`"code":${JSON_RPC_ERROR_CODES.PARSE_ERROR}`)
      );
    });
  });
});

describe("StdioTransport Integration", () => {
  let transport: StdioTransport;
  let mockStdout: jest.SpyInstance;
  let mockStdin: Readable;
  let originalStdin: NodeJS.ReadableStream;

  beforeEach(() => {
    transport = new StdioTransport();
    mockStdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

    mockStdin = new Readable({
      read() {
        // Mock implementation - no-op
      },
    });

    originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      configurable: true,
    });
  });

  afterEach(async () => {
    await transport.stop();
    mockStdout.mockRestore();

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
  });

  const sendMessage = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 10);
      mockStdin.push(`${message}\n`);
      mockStdin.push(null);
    });
  };

  const sendMultipleMessages = (messages: string[]): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 10);
      messages.forEach((msg) => mockStdin.push(`${msg}\n`));
      mockStdin.push(null);
    });
  };

  it("should work with transport registry pattern", async () => {
    const dispatch = jest.fn();

    expect(transport.name).toBe("stdio");
    expect(typeof transport.start).toBe("function");
    expect(typeof transport.stop).toBe("function");

    await transport.start(dispatch);

    const request = '{"jsonrpc":"2.0","id":"test-123","method":"ping"}';
    await sendMessage(request);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: "test-123",
        method: "ping",
      }),
      expect.any(Function),
      expect.objectContaining({
        transport: { name: "stdio" },
      })
    );

    await transport.stop();
  });

  it("should handle concurrent message processing", async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    const requests = [
      '{"jsonrpc":"2.0","id":1,"method":"first"}',
      '{"jsonrpc":"2.0","id":2,"method":"second"}',
      '{"jsonrpc":"2.0","id":3,"method":"third"}',
    ];

    await sendMultipleMessages(requests);

    expect(dispatch).toHaveBeenCalledTimes(3);

    const responses = [
      { jsonrpc: "2.0", id: 1, result: "first-result" },
      { jsonrpc: "2.0", id: 2, result: "second-result" },
      { jsonrpc: "2.0", id: 3, result: "third-result" },
    ];

    dispatch.mock.calls.forEach(([, respond], index) => {
      respond(responses[index]);
    });

    expect(mockStdout).toHaveBeenCalledTimes(3);
    responses.forEach((response) => {
      expect(mockStdout).toHaveBeenCalledWith(`${JSON.stringify(response)}\n`);
    });
  });

  it("should provide correct metadata structure", async () => {
    const dispatch = jest.fn();
    await transport.start(dispatch);

    const request = '{"jsonrpc":"2.0","id":"meta-test","method":"getMetadata"}';
    await sendMessage(request);

    const [, , metadata] = dispatch.mock.calls[0];

    expect(metadata).toEqual({
      transport: {
        name: "stdio",
      },
    });
  });
});
