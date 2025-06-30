import { MockTransport } from '../src/mock-transport';
import { TransportRegistry } from '../src/registry';
import type { ServerTransport, TransportDispatch } from '../src/types';

describe('TransportRegistry', () => {
  let registry: TransportRegistry;

  beforeEach(() => {
    registry = new TransportRegistry();
  });

  describe('constructor', () => {
    it('should create an empty registry', () => {
      expect(registry.size).toBe(0);
      expect(registry.getTransports()).toHaveLength(0);
    });
  });

  describe('registerTransport', () => {
    it('should register a transport successfully', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      registry.registerTransport(transport);

      expect(registry.size).toBe(1);
      expect(registry.hasTransport(transport)).toBe(true);
      expect(registry.getTransports()).toContain(transport);
    });

    it('should prevent duplicate transport registration', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      registry.registerTransport(transport);
      registry.registerTransport(transport);

      expect(registry.size).toBe(1);
      expect(registry.getTransports()).toHaveLength(1);
    });

    it('should register multiple different transports', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });
      const transport3 = new MockTransport({ name: 'transport-3' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      expect(registry.size).toBe(3);
      expect(registry.hasTransport(transport1)).toBe(true);
      expect(registry.hasTransport(transport2)).toBe(true);
      expect(registry.hasTransport(transport3)).toBe(true);
    });

    it('should throw error for null transport', () => {
      expect(() => registry.registerTransport(null as any)).toThrow('Transport cannot be null or undefined');
    });

    it('should throw error for undefined transport', () => {
      expect(() => registry.registerTransport(undefined as any)).toThrow('Transport cannot be null or undefined');
    });
  });

  describe('getTransports', () => {
    it('should return empty array for empty registry', () => {
      const transports = registry.getTransports();

      expect(transports).toHaveLength(0);
      expect(Array.isArray(transports)).toBe(true);
    });

    it('should return all registered transports', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      const transports = registry.getTransports();

      expect(transports).toHaveLength(2);
      expect(transports).toContain(transport1);
      expect(transports).toContain(transport2);
    });

    it('should return a new array each time', () => {
      const transport = new MockTransport({ name: 'test-transport' });
      registry.registerTransport(transport);

      const transports1 = registry.getTransports();
      const transports2 = registry.getTransports();

      expect(transports1).not.toBe(transports2);
      expect(transports1).toEqual(transports2);
    });

    it('should return readonly array that cannot modify registry', () => {
      const transport = new MockTransport({ name: 'test-transport' });
      registry.registerTransport(transport);

      const transports = registry.getTransports();
      // @ts-expect-error: Testing readonly array
      transports.push(new MockTransport({ name: 'should-not-affect-registry' }));

      expect(registry.size).toBe(1);
      expect(registry.getTransports()).toHaveLength(1);
    });
  });

  describe('hasTransport', () => {
    it('should return false for unregistered transport', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      expect(registry.hasTransport(transport)).toBe(false);
    });

    it('should return true for registered transport', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      registry.registerTransport(transport);

      expect(registry.hasTransport(transport)).toBe(true);
    });

    it('should return false after transport is unregistered', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      registry.registerTransport(transport);
      registry.unregisterTransport(transport);

      expect(registry.hasTransport(transport)).toBe(false);
    });
  });

  describe('unregisterTransport', () => {
    it('should return false for unregistered transport', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      const result = registry.unregisterTransport(transport);

      expect(result).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('should return true and remove registered transport', () => {
      const transport = new MockTransport({ name: 'test-transport' });

      registry.registerTransport(transport);
      const result = registry.unregisterTransport(transport);

      expect(result).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.hasTransport(transport)).toBe(false);
    });

    it('should only remove specified transport', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      const result = registry.unregisterTransport(transport1);

      expect(result).toBe(true);
      expect(registry.size).toBe(1);
      expect(registry.hasTransport(transport1)).toBe(false);
      expect(registry.hasTransport(transport2)).toBe(true);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count after registrations', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });

      expect(registry.size).toBe(0);

      registry.registerTransport(transport1);
      expect(registry.size).toBe(1);

      registry.registerTransport(transport2);
      expect(registry.size).toBe(2);
    });

    it('should return correct count after unregistrations', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      expect(registry.size).toBe(2);

      registry.unregisterTransport(transport1);
      expect(registry.size).toBe(1);

      registry.unregisterTransport(transport2);
      expect(registry.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear empty registry without error', () => {
      registry.clear();

      expect(registry.size).toBe(0);
    });

    it('should remove all registered transports', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });
      const transport3 = new MockTransport({ name: 'transport-3' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      expect(registry.size).toBe(3);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.hasTransport(transport1)).toBe(false);
      expect(registry.hasTransport(transport2)).toBe(false);
      expect(registry.hasTransport(transport3)).toBe(false);
      expect(registry.getTransports()).toHaveLength(0);
    });
  });

  describe('iterator', () => {
    it('should iterate over empty registry', () => {
      const transports = Array.from(registry);

      expect(transports).toHaveLength(0);
    });

    it('should iterate over all registered transports', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });
      const transport3 = new MockTransport({ name: 'transport-3' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      const transports = Array.from(registry);

      expect(transports).toHaveLength(3);
      expect(transports).toContain(transport1);
      expect(transports).toContain(transport2);
      expect(transports).toContain(transport3);
    });

    it('should support for-of iteration', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);

      const names: string[] = [];
      for (const transport of Array.from(registry)) {
        names.push(transport.name);
      }

      expect(names).toHaveLength(2);
      expect(names).toContain('transport-1');
      expect(names).toContain('transport-2');
    });

    it('should support functional programming patterns', () => {
      const transport1 = new MockTransport({ name: 'transport-1' });
      const transport2 = new MockTransport({ name: 'transport-2' });
      const transport3 = new MockTransport({ name: 'transport-3' });

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport3);

      const names = Array.from(registry)
        .map((t) => t.name)
        .sort();

      expect(names).toEqual(['transport-1', 'transport-2', 'transport-3']);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex registration and unregistration patterns', () => {
      const transports = Array.from({ length: 5 }, (_, i) => new MockTransport({ name: `transport-${i}` }));

      transports.forEach((t) => registry.registerTransport(t));
      expect(registry.size).toBe(5);

      const transport1 = transports[1];
      const transport3 = transports[3];
      if (transport1) {
        registry.unregisterTransport(transport1);
      }
      if (transport3) {
        registry.unregisterTransport(transport3);
      }
      expect(registry.size).toBe(3);

      registry.registerTransport(new MockTransport({ name: 'new-transport' }));
      expect(registry.size).toBe(4);

      registry.clear();
      expect(registry.size).toBe(0);
    });

    it('should maintain Set semantics with custom transport implementations', () => {
      class CustomTransport implements ServerTransport {
        readonly name = 'custom';
        async start(_dispatch: TransportDispatch): Promise<void> {
          // No-op for testing
        }
        async stop(): Promise<void> {
          // No-op for testing
        }
      }

      const transport1 = new CustomTransport();
      const transport2 = new CustomTransport();

      registry.registerTransport(transport1);
      registry.registerTransport(transport2);
      registry.registerTransport(transport1);

      expect(registry.size).toBe(2);
      expect(registry.hasTransport(transport1)).toBe(true);
      expect(registry.hasTransport(transport2)).toBe(true);
    });
  });
});
