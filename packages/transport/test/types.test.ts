import type { ServerTransport, TransportDispatch, TransportMetadata } from "../src/types";
import { TransportState } from "../src/types";

describe("Transport Types", () => {
  describe("TransportState enum", () => {
    it("should have all required states", () => {
      expect(TransportState.STOPPED).toBe("stopped");
      expect(TransportState.STARTING).toBe("starting");
      expect(TransportState.RUNNING).toBe("running");
      expect(TransportState.STOPPING).toBe("stopping");
      expect(TransportState.ERROR).toBe("error");
    });

    it("should have exactly 5 states", () => {
      const states = Object.values(TransportState);
      expect(states).toHaveLength(5);
    });
  });

  describe("TransportMetadata interface", () => {
    it("should accept valid metadata with peer info", () => {
      const metadata: TransportMetadata = {
        peer: {
          ip: "192.168.1.1",
          userAgent: "TestClient/1.0",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer token123",
          },
          customField: "custom value",
        },
        transportSpecific: "some data",
      };

      expect(metadata.peer?.ip).toBe("192.168.1.1");
      expect(metadata.peer?.userAgent).toBe("TestClient/1.0");
      expect(metadata.peer?.headers?.["content-type"]).toBe("application/json");
      expect(metadata.transportSpecific).toBe("some data");
    });

    it("should accept minimal metadata", () => {
      const metadata: TransportMetadata = {};
      expect(metadata).toEqual({});
    });

    it("should accept metadata with only peer info", () => {
      const metadata: TransportMetadata = {
        peer: {
          ip: "127.0.0.1",
        },
      };
      expect(metadata.peer?.ip).toBe("127.0.0.1");
    });

    it("should accept metadata with custom extensions", () => {
      const metadata: TransportMetadata = {
        customExtension: {
          nested: {
            data: "value",
          },
        },
        simpleField: 42,
      };
      expect(metadata.customExtension).toEqual({ nested: { data: "value" } });
      expect(metadata.simpleField).toBe(42);
    });
  });

  describe("TransportDispatch function type", () => {
    it("should accept valid dispatch function", () => {
      const dispatch: TransportDispatch = (message, respond, metadata) => {
        expect(message).toBeDefined();
        expect(typeof respond).toBe("function");
        expect(metadata).toBeUndefined();
      };

      dispatch({ method: "test" }, async () => {
        // Empty response callback for testing
      });
    });

    it("should work with metadata parameter", () => {
      const dispatch: TransportDispatch = (message, respond, metadata) => {
        expect(message).toEqual({ method: "test" });
        expect(typeof respond).toBe("function");
        expect(metadata?.peer?.ip).toBe("127.0.0.1");
      };

      dispatch(
        { method: "test" },
        async () => {
          // Empty response callback for testing
        },
        { peer: { ip: "127.0.0.1" } }
      );
    });

    it("should handle async respond callback", async () => {
      let responseReceived: unknown;
      const dispatch: TransportDispatch = async (_message, respond) => {
        await respond({ result: "success" });
      };

      const respond = async (response: unknown) => {
        responseReceived = response;
      };

      await dispatch({ method: "test" }, respond);
      expect(responseReceived).toEqual({ result: "success" });
    });
  });

  describe("ServerTransport interface", () => {
    class TestTransport implements ServerTransport {
      readonly name = "test";
      private _started = false;

      async start(_dispatch: TransportDispatch): Promise<void> {
        if (this._started) {
          throw new Error("Already started");
        }
        this._started = true;
      }

      async stop(): Promise<void> {
        this._started = false;
      }

      get isStarted(): boolean {
        return this._started;
      }
    }

    it("should implement required interface methods", async () => {
      const transport = new TestTransport();
      expect(transport.name).toBe("test");
      expect(typeof transport.start).toBe("function");
      expect(typeof transport.stop).toBe("function");
    });

    it("should handle start lifecycle", async () => {
      const transport = new TestTransport();
      expect(transport.isStarted).toBe(false);

      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };
      await transport.start(mockDispatch);
      expect(transport.isStarted).toBe(true);
    });

    it("should handle stop lifecycle", async () => {
      const transport = new TestTransport();
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      expect(transport.isStarted).toBe(true);

      await transport.stop();
      expect(transport.isStarted).toBe(false);
    });

    it("should prevent double start", async () => {
      const transport = new TestTransport();
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      await expect(transport.start(mockDispatch)).rejects.toThrow("Already started");
    });

    it("should allow multiple stops", async () => {
      const transport = new TestTransport();
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      await transport.stop();
      await transport.stop();
      expect(transport.isStarted).toBe(false);
    });
  });
});
