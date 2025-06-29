import { MockTransport } from "../src/mock-transport";
import {
  startAllTransports,
  stopAllTransports,
  TransportOrchestrationError,
} from "../src/orchestrator";
import { TransportRegistry } from "../src/registry";
import type { TransportDispatch, TransportMetadata } from "../src/types";
import { TransportState } from "../src/types";

describe("Transport Orchestrator", () => {
  let registry: TransportRegistry;
  let mockDispatch: TransportDispatch;
  let receivedMessages: Array<{ message: unknown; metadata?: TransportMetadata }>;

  beforeEach(() => {
    registry = new TransportRegistry();
    receivedMessages = [];
    mockDispatch = (message, respond, metadata) => {
      receivedMessages.push(metadata ? { message, metadata } : { message });
      respond({ echo: message, processed: true });
    };
  });

  describe("startAllTransports", () => {
    it("should start all transports successfully", async () => {
      const transport1 = new MockTransport({ name: "transport-1" });
      const transport2 = new MockTransport({ name: "transport-2" });
      const transport3 = new MockTransport({ name: "transport-3" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      await startAllTransports(registry, mockDispatch);

      expect(transport1.state).toBe(TransportState.RUNNING);
      expect(transport2.state).toBe(TransportState.RUNNING);
      expect(transport3.state).toBe(TransportState.RUNNING);
    });

    it("should handle empty registry", async () => {
      await expect(startAllTransports(registry, mockDispatch)).resolves.toBeUndefined();
    });

    it("should throw error for null registry", async () => {
      await expect(startAllTransports(null as any, mockDispatch)).rejects.toThrow(
        "Registry cannot be null or undefined"
      );
    });

    it("should throw error for undefined registry", async () => {
      await expect(startAllTransports(undefined as any, mockDispatch)).rejects.toThrow(
        "Registry cannot be null or undefined"
      );
    });

    it("should throw error for non-function dispatch", async () => {
      await expect(startAllTransports(registry, "not-a-function" as any)).rejects.toThrow(
        "Dispatch must be a function"
      );
    });

    it("should collect and report transport start failures", async () => {
      const transport1 = new MockTransport({ name: "transport-1" });
      const transport2 = new MockTransport({ name: "transport-2", simulateStartError: true });
      const transport3 = new MockTransport({ name: "transport-3", simulateStartError: true });
      const transport4 = new MockTransport({ name: "transport-4" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);
      registry.registerTransport(transport4);

      try {
        await startAllTransports(registry, mockDispatch);
        // biome-ignore lint/correctness/noUndeclaredVariables: Jest global
        fail("Expected TransportOrchestrationError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
        const orchestrationError = error as TransportOrchestrationError;

        expect(orchestrationError.message).toContain(
          "Failed to start 2 of 4 transports (2 succeeded)"
        );
        expect(orchestrationError.failures).toHaveLength(2);

        const failedTransportNames = orchestrationError.failures.map((f) => f.transport);
        expect(failedTransportNames).toContain("transport-2");
        expect(failedTransportNames).toContain("transport-3");

        orchestrationError.failures.forEach((failure) => {
          expect(failure.error).toBeInstanceOf(Error);
          expect(failure.error.message).toBe("Simulated start error");
        });
      }

      expect(transport1.state).toBe(TransportState.RUNNING);
      expect(transport2.state).toBe(TransportState.ERROR);
      expect(transport3.state).toBe(TransportState.ERROR);
      expect(transport4.state).toBe(TransportState.RUNNING);
    });

    it("should handle all transports failing", async () => {
      const transport1 = new MockTransport({ name: "transport-1", simulateStartError: true });
      const transport2 = new MockTransport({ name: "transport-2", simulateStartError: true });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      try {
        await startAllTransports(registry, mockDispatch);
        // biome-ignore lint/correctness/noUndeclaredVariables: Jest global
        fail("Expected TransportOrchestrationError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
        const orchestrationError = error as TransportOrchestrationError;

        expect(orchestrationError.message).toContain(
          "Failed to start 2 of 2 transports (0 succeeded)"
        );
        expect(orchestrationError.failures).toHaveLength(2);
      }
    });

    it("should handle non-Error exceptions from transports", async () => {
      class FailingTransport extends MockTransport {
        override async start(_dispatch: TransportDispatch): Promise<void> {
          throw "String error";
        }
      }

      const transport = new FailingTransport({ name: "failing-transport" });
      registry.registerTransport(transport);

      try {
        await startAllTransports(registry, mockDispatch);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
        const orchestrationError = error as TransportOrchestrationError;

        expect(orchestrationError.failures).toHaveLength(1);
        expect(orchestrationError.failures[0]?.error).toBeInstanceOf(Error);
        expect(orchestrationError.failures[0]?.error.message).toBe("String error");
      }
    });
  });

  describe("stopAllTransports", () => {
    it("should stop all transports successfully", async () => {
      const transport1 = new MockTransport({ name: "transport-1" });
      const transport2 = new MockTransport({ name: "transport-2" });
      const transport3 = new MockTransport({ name: "transport-3" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      await startAllTransports(registry, mockDispatch);
      await stopAllTransports(registry);

      expect(transport1.state).toBe(TransportState.STOPPED);
      expect(transport2.state).toBe(TransportState.STOPPED);
      expect(transport3.state).toBe(TransportState.STOPPED);
    });

    it("should handle empty registry", async () => {
      await expect(stopAllTransports(registry)).resolves.toBeUndefined();
    });

    it("should throw error for null registry", async () => {
      await expect(stopAllTransports(null as any)).rejects.toThrow(
        "Registry cannot be null or undefined"
      );
    });

    it("should throw error for undefined registry", async () => {
      await expect(stopAllTransports(undefined as any)).rejects.toThrow(
        "Registry cannot be null or undefined"
      );
    });

    it("should collect and report transport stop failures", async () => {
      const transport1 = new MockTransport({ name: "transport-1" });
      const transport2 = new MockTransport({ name: "transport-2", simulateStopError: true });
      const transport3 = new MockTransport({ name: "transport-3", simulateStopError: true });
      const transport4 = new MockTransport({ name: "transport-4" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);
      registry.registerTransport(transport4);

      await startAllTransports(registry, mockDispatch);

      await expect(stopAllTransports(registry)).rejects.toThrow(TransportOrchestrationError);

      try {
        await stopAllTransports(registry);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
        const orchestrationError = error as TransportOrchestrationError;

        expect(orchestrationError.message).toContain(
          "Failed to stop 2 of 4 transports (2 succeeded)"
        );
        expect(orchestrationError.failures).toHaveLength(2);

        const failedTransportNames = orchestrationError.failures.map((f) => f.transport);
        expect(failedTransportNames).toContain("transport-2");
        expect(failedTransportNames).toContain("transport-3");
      }

      expect(transport1.state).toBe(TransportState.STOPPED);
      expect(transport2.state).toBe(TransportState.ERROR);
      expect(transport3.state).toBe(TransportState.ERROR);
      expect(transport4.state).toBe(TransportState.STOPPED);
    });

    it("should stop transports that are not running", async () => {
      const transport1 = new MockTransport({ name: "transport-1" });
      const transport2 = new MockTransport({ name: "transport-2" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      await stopAllTransports(registry);

      expect(transport1.state).toBe(TransportState.STOPPED);
      expect(transport2.state).toBe(TransportState.STOPPED);
    });
  });

  describe("integration scenarios", () => {
    it("should handle full lifecycle with multiple transports", async () => {
      const transport1 = new MockTransport({ name: "stdio" });
      const transport2 = new MockTransport({ name: "http-sse" });
      const transport3 = new MockTransport({ name: "websocket" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      await startAllTransports(registry, mockDispatch);

      transport1.sendMessage({ method: "test1", params: [1, 2, 3] });
      transport2.sendMessage({ method: "test2", params: { key: "value" } });
      transport3.sendMessage({ method: "test3" }, { peer: { ip: "127.0.0.1" } });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(receivedMessages).toHaveLength(3);
      expect(transport1.responses).toHaveLength(1);
      expect(transport2.responses).toHaveLength(1);
      expect(transport3.responses).toHaveLength(1);

      await stopAllTransports(registry);

      expect(transport1.state).toBe(TransportState.STOPPED);
      expect(transport2.state).toBe(TransportState.STOPPED);
      expect(transport3.state).toBe(TransportState.STOPPED);
    });

    it("should handle mixed success and failure scenarios", async () => {
      const workingTransport = new MockTransport({ name: "working" });
      const failingStartTransport = new MockTransport({
        name: "failing-start",
        simulateStartError: true,
      });
      const failingStopTransport = new MockTransport({
        name: "failing-stop",
        simulateStopError: true,
      });

      registry.registerTransport(workingTransport);
      registry.registerTransport(failingStartTransport);
      registry.registerTransport(failingStopTransport);

      try {
        await startAllTransports(registry, mockDispatch);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
      }

      expect(workingTransport.state).toBe(TransportState.RUNNING);
      expect(failingStartTransport.state).toBe(TransportState.ERROR);
      expect(failingStopTransport.state).toBe(TransportState.RUNNING);

      workingTransport.sendMessage({ method: "test" });
      failingStopTransport.sendMessage({ method: "test" });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(receivedMessages).toHaveLength(2);

      try {
        await stopAllTransports(registry);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportOrchestrationError);
      }

      expect(workingTransport.state).toBe(TransportState.STOPPED);
      expect(failingStopTransport.state).toBe(TransportState.ERROR);
    });

    it("should handle concurrent message processing", async () => {
      const transport1 = new MockTransport({ name: "concurrent-1" });
      const transport2 = new MockTransport({ name: "concurrent-2" });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      await startAllTransports(registry, mockDispatch);

      for (let i = 0; i < 10; i++) {
        transport1.sendMessage({ method: "concurrent", id: i });
        transport2.sendMessage({ method: "concurrent", id: i + 10 });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedMessages).toHaveLength(20);
      expect(transport1.responses).toHaveLength(10);
      expect(transport2.responses).toHaveLength(10);

      await stopAllTransports(registry);
    });

    it("should maintain transport isolation during failures", async () => {
      const stableTransport = new MockTransport({ name: "stable" });
      const unstableTransport = new MockTransport({ name: "unstable" });

      registry.registerTransport(stableTransport);
      registry.registerTransport(unstableTransport);

      await startAllTransports(registry, mockDispatch);

      stableTransport.sendMessage({ method: "stable-message" });
      unstableTransport.sendMessage({ method: "unstable-message" });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stableTransport.responses).toHaveLength(1);
      expect(unstableTransport.responses).toHaveLength(1);
      expect(receivedMessages).toHaveLength(2);

      await stopAllTransports(registry);

      expect(stableTransport.state).toBe(TransportState.STOPPED);
      expect(unstableTransport.state).toBe(TransportState.STOPPED);
    });
  });
});
