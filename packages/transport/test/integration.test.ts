import type { TransportDispatch, TransportMetadata } from '../src';
import { MockTransport, TransportState } from '../src';

describe('Transport Integration', () => {
  describe('multiple transports coordination', () => {
    it('should handle multiple transports simultaneously', async () => {
      const transport1 = new MockTransport({ name: 'transport1' });
      const transport2 = new MockTransport({ name: 'transport2' });

      const receivedMessages: Array<{ transport: string; message: unknown }> = [];

      const createDispatch = (transportName: string): TransportDispatch => {
        return (message, respond) => {
          receivedMessages.push({ transport: transportName, message });
          respond({ from: transportName, echo: message });
        };
      };

      await Promise.all([transport1.start(createDispatch('transport1')), transport2.start(createDispatch('transport2'))]);

      transport1.sendMessage({ method: 'test1' });
      transport2.sendMessage({ method: 'test2' });

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0]?.transport).toBe('transport1');
      expect(receivedMessages[1]?.transport).toBe('transport2');

      await Promise.all([transport1.stop(), transport2.stop()]);
    });

    it('should handle graceful shutdown of multiple transports', async () => {
      const transports = [
        new MockTransport({ name: 't1', stopDelay: 10 }),
        new MockTransport({ name: 't2', stopDelay: 20 }),
        new MockTransport({ name: 't3', stopDelay: 5 }),
      ];

      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await Promise.all(transports.map((t) => t.start(mockDispatch)));

      const startTime = Date.now();
      await Promise.all(transports.map((t) => t.stop()));
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(15);
      transports.forEach((t) => {
        expect(t.state).toBe(TransportState.STOPPED);
      });
    });
  });

  describe('middleware simulation', () => {
    it('should support middleware-like message processing', async () => {
      const transport = new MockTransport();
      const middlewareLog: string[] = [];

      const createMiddleware = (name: string) => {
        return (next: TransportDispatch): TransportDispatch => {
          return async (message, respond, metadata) => {
            middlewareLog.push(`${name}:before`);

            const wrappedRespond = async (response: unknown) => {
              middlewareLog.push(`${name}:after`);
              await respond(response);
            };

            next(message, wrappedRespond, metadata);
          };
        };
      };

      const finalHandler: TransportDispatch = (_message, respond) => {
        middlewareLog.push('handler');
        respond({ processed: true });
      };

      const middleware1 = createMiddleware('middleware1');
      const middleware2 = createMiddleware('middleware2');

      const composedDispatch = middleware1(middleware2(finalHandler));

      await transport.start(composedDispatch);
      transport.sendMessage({ method: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(middlewareLog).toEqual(['middleware1:before', 'middleware2:before', 'handler', 'middleware2:after', 'middleware1:after']);
    });
  });

  describe('error handling patterns', () => {
    it('should handle transport errors gracefully', async () => {
      const errorTransport = new MockTransport({ simulateStartError: true });
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      let startError: Error | null = null;
      try {
        await errorTransport.start(mockDispatch);
      } catch (error) {
        startError = error as Error;
      }

      expect(startError).toBeInstanceOf(Error);
      expect(startError?.message).toBe('Simulated start error');
      expect(errorTransport.state).toBe(TransportState.ERROR);
    });

    it('should handle dispatch errors without crashing', async () => {
      const transport = new MockTransport();
      const errorDispatch: TransportDispatch = () => {
        throw new Error('Dispatch failed');
      };

      await transport.start(errorDispatch);

      expect(() => {
        transport.sendMessage({ method: 'test' });
      }).not.toThrow();

      expect(transport.state).toBe(TransportState.RUNNING);
    });

    it('should handle respond callback errors', async () => {
      const transport = new MockTransport();
      const dispatch: TransportDispatch = async (_message, respond) => {
        try {
          await respond({ result: 'success' });
        } catch (error) {
          console.error('Respond failed:', error);
        }
      };

      await transport.start(dispatch);
      transport.sendMessage({ method: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(transport.responses).toHaveLength(1);
    });
  });

  describe('metadata handling patterns', () => {
    it('should preserve and transform metadata through processing', async () => {
      const transport = new MockTransport();
      let processedMetadata: TransportMetadata | undefined;

      const dispatch: TransportDispatch = (message, respond, metadata) => {
        processedMetadata = metadata;
        respond({
          message,
          clientInfo: metadata?.peer?.userAgent,
          timestamp: Date.now(),
        });
      };

      await transport.start(dispatch);

      const metadata: TransportMetadata = {
        peer: {
          ip: '192.168.1.100',
          userAgent: 'TestClient/2.0',
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req-123',
          },
        },
        requestId: 'req-123',
        timestamp: Date.now(),
      };

      transport.sendMessage({ method: 'getUserInfo' }, metadata);

      expect(processedMetadata).toEqual(metadata);
      expect(processedMetadata?.peer?.ip).toBe('192.168.1.100');
      expect(processedMetadata?.peer?.userAgent).toBe('TestClient/2.0');
      expect(processedMetadata?.requestId).toBe('req-123');
    });

    it('should handle missing metadata gracefully', async () => {
      const transport = new MockTransport();
      let receivedMetadata: TransportMetadata | undefined;

      const dispatch: TransportDispatch = (_message, respond, metadata) => {
        receivedMetadata = metadata;
        respond({ hasMetadata: metadata !== undefined });
      };

      await transport.start(dispatch);
      transport.sendMessage({ method: 'test' });

      expect(receivedMetadata).toBeUndefined();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(transport.responses[0]?.response).toEqual({ hasMetadata: false });
    });
  });

  describe('performance and concurrency', () => {
    it('should handle high message volume', async () => {
      const transport = new MockTransport();
      const messageCount = 1000;
      let processedCount = 0;

      const dispatch: TransportDispatch = (_message, respond) => {
        processedCount++;
        respond({ index: processedCount });
      };

      await transport.start(dispatch);

      for (let i = 0; i < messageCount; i++) {
        transport.sendMessage({ index: i });
      }

      expect(processedCount).toBe(messageCount);
      expect(transport.messageCount).toBe(messageCount);
    });

    it('should maintain message ordering under load', async () => {
      const transport = new MockTransport();
      const messageCount = 100;
      const processedOrder: number[] = [];

      const dispatch: TransportDispatch = (message, respond) => {
        const msg = message as { index: number };
        processedOrder.push(msg.index);
        respond({ processed: msg.index });
      };

      await transport.start(dispatch);

      for (let i = 0; i < messageCount; i++) {
        transport.sendMessage({ index: i });
      }

      expect(processedOrder).toHaveLength(messageCount);
      for (let i = 0; i < messageCount; i++) {
        expect(processedOrder[i]).toBe(i);
      }
    });
  });

  describe('lifecycle edge cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      const transport = new MockTransport();
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      for (let i = 0; i < 5; i++) {
        await transport.start(mockDispatch);
        expect(transport.state).toBe(TransportState.RUNNING);

        await transport.stop();
        expect(transport.state).toBe(TransportState.STOPPED);
      }
    });

    it('should handle messages sent during shutdown', async () => {
      const transport = new MockTransport({ stopDelay: 50 });
      let processedCount = 0;

      const dispatch: TransportDispatch = (_message, respond) => {
        processedCount++;
        respond({ count: processedCount });
      };

      await transport.start(dispatch);

      transport.sendMessage({ method: 'test1' });

      const stopPromise = transport.stop();

      transport.sendMessage({ method: 'test2' });

      await stopPromise;

      expect(processedCount).toBe(1);
      expect(transport.state).toBe(TransportState.STOPPED);
    });
  });
});
