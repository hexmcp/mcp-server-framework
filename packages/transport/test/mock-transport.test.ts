import type { TransportDispatch, TransportMetadata } from '../src';
import { MockTransport, TransportState } from '../src';

describe('MockTransport', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  afterEach(async () => {
    if (transport.state !== TransportState.STOPPED) {
      await transport.stop();
    }
  });

  describe('constructor', () => {
    it('should create transport with default name', () => {
      expect(transport.name).toBe('mock');
      expect(transport.state).toBe(TransportState.STOPPED);
    });

    it('should create transport with custom name', () => {
      const customTransport = new MockTransport({ name: 'custom-mock' });
      expect(customTransport.name).toBe('custom-mock');
    });

    it('should initialize with empty responses and zero message count', () => {
      expect(transport.responses).toEqual([]);
      expect(transport.messageCount).toBe(0);
    });
  });

  describe('lifecycle management', () => {
    it('should start successfully', async () => {
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      expect(transport.state).toBe(TransportState.STOPPED);
      await transport.start(mockDispatch);
      expect(transport.state).toBe(TransportState.RUNNING);
    });

    it('should stop successfully', async () => {
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      expect(transport.state).toBe(TransportState.RUNNING);

      await transport.stop();
      expect(transport.state).toBe(TransportState.STOPPED);
    });

    it('should prevent starting when not stopped', async () => {
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      await expect(transport.start(mockDispatch)).rejects.toThrow('Cannot start transport in state: running');
    });

    it('should allow multiple stops', async () => {
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await transport.start(mockDispatch);
      await transport.stop();
      await transport.stop();
      expect(transport.state).toBe(TransportState.STOPPED);
    });

    it('should handle start with delay', async () => {
      const startTime = Date.now();
      const delayedTransport = new MockTransport({ startDelay: 50 });
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await delayedTransport.start(mockDispatch);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(delayedTransport.state).toBe(TransportState.RUNNING);
    });

    it('should handle stop with delay', async () => {
      const delayedTransport = new MockTransport({ stopDelay: 50 });
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await delayedTransport.start(mockDispatch);
      const startTime = Date.now();
      await delayedTransport.stop();
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(delayedTransport.state).toBe(TransportState.STOPPED);
    });

    it('should simulate start error', async () => {
      const errorTransport = new MockTransport({ simulateStartError: true });
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await expect(errorTransport.start(mockDispatch)).rejects.toThrow('Simulated start error');
      expect(errorTransport.state).toBe(TransportState.ERROR);
    });

    it('should simulate stop error', async () => {
      const errorTransport = new MockTransport({ simulateStopError: true });
      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };

      await errorTransport.start(mockDispatch);
      await expect(errorTransport.stop()).rejects.toThrow('Simulated stop error');
      expect(errorTransport.state).toBe(TransportState.ERROR);
    });
  });

  describe('message handling', () => {
    let receivedMessages: Array<{ message: unknown; metadata?: TransportMetadata }>;
    let mockDispatch: TransportDispatch;

    beforeEach(() => {
      receivedMessages = [];
      mockDispatch = (message, respond, metadata) => {
        receivedMessages.push(metadata ? { message, metadata } : { message });
        respond({ echo: message });
      };
    });

    it('should process messages when running', async () => {
      await transport.start(mockDispatch);

      transport.sendMessage({ method: 'test', params: [1, 2, 3] });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]?.message).toEqual({ method: 'test', params: [1, 2, 3] });
      expect(transport.messageCount).toBe(1);
    });

    it('should queue messages when not running', () => {
      transport.sendMessage({ method: 'queued' });

      expect(receivedMessages).toHaveLength(0);
      expect(transport.messageCount).toBe(0);
    });

    it('should process queued messages on start', async () => {
      transport.sendMessage({ method: 'queued1' });
      transport.sendMessage({ method: 'queued2' });

      await transport.start(mockDispatch);

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0]?.message).toEqual({ method: 'queued1' });
      expect(receivedMessages[1]?.message).toEqual({ method: 'queued2' });
      expect(transport.messageCount).toBe(2);
    });

    it('should handle messages with metadata', async () => {
      await transport.start(mockDispatch);

      const metadata: TransportMetadata = {
        peer: { ip: '192.168.1.1', userAgent: 'TestClient/1.0' },
      };

      transport.sendMessage({ method: 'test' }, metadata);

      expect(receivedMessages[0]?.metadata).toEqual(metadata);
    });

    it('should capture responses', async () => {
      await transport.start(mockDispatch);

      transport.sendMessage({ method: 'test1' });
      transport.sendMessage({ method: 'test2' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transport.responses).toHaveLength(2);
      expect(transport.responses[0]?.response).toEqual({ echo: { method: 'test1' } });
      expect(transport.responses[1]?.response).toEqual({ echo: { method: 'test2' } });
      expect(transport.responses[0]?.messageIndex).toBe(0);
      expect(transport.responses[1]?.messageIndex).toBe(1);
    });
  });

  describe('utility methods', () => {
    it('should clear responses', async () => {
      const mockDispatch: TransportDispatch = (_message, respond) => {
        respond({ result: 'test' });
      };

      await transport.start(mockDispatch);
      transport.sendMessage({ method: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(transport.responses).toHaveLength(1);

      transport.clearResponses();
      expect(transport.responses).toHaveLength(0);
    });

    it('should clear message queue', () => {
      transport.sendMessage({ method: 'test1' });
      transport.sendMessage({ method: 'test2' });

      transport.clearMessageQueue();

      const mockDispatch: TransportDispatch = () => {
        // Empty dispatch for testing
      };
      transport.start(mockDispatch);

      expect(transport.messageCount).toBe(0);
    });

    it('should reset transport state', async () => {
      const mockDispatch: TransportDispatch = (_message, respond) => {
        respond({ result: 'test' });
      };

      await transport.start(mockDispatch);
      transport.sendMessage({ method: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      transport.reset();

      expect(transport.state).toBe(TransportState.STOPPED);
      expect(transport.responses).toHaveLength(0);
      expect(transport.messageCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle dispatch throwing error', async () => {
      const errorDispatch: TransportDispatch = () => {
        throw new Error('Dispatch error');
      };

      await transport.start(errorDispatch);

      expect(() => transport.sendMessage({ method: 'test' })).not.toThrow();
    });

    it('should handle respond callback throwing error', async () => {
      const errorDispatch: TransportDispatch = async (_message, respond) => {
        await respond({ result: 'test' });
      };

      await transport.start(errorDispatch);

      expect(() => transport.sendMessage({ method: 'test' })).not.toThrow();
    });

    it('should handle complex message types', async () => {
      let receivedMessage: unknown;
      const mockDispatch: TransportDispatch = (message, respond) => {
        receivedMessage = message;
        respond({ received: true });
      };

      await transport.start(mockDispatch);

      const complexMessage = {
        nested: { deep: { value: 42 } },
        array: [1, 'string', { obj: true }],
        nullValue: null,
        undefinedValue: undefined,
      };

      transport.sendMessage(complexMessage);

      expect(receivedMessage).toEqual(complexMessage);
    });

    it('should maintain message order', async () => {
      const processedMessages: unknown[] = [];
      const mockDispatch: TransportDispatch = (message, respond) => {
        processedMessages.push(message);
        respond({ index: processedMessages.length - 1 });
      };

      await transport.start(mockDispatch);

      for (let i = 0; i < 10; i++) {
        transport.sendMessage({ index: i });
      }

      expect(processedMessages).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(processedMessages[i]).toEqual({ index: i });
      }
    });
  });
});
