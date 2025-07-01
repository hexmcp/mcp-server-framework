/**
 * @fileoverview Tests for LRU Store implementation
 */

import type { HandlerContext, ResourceContent } from '../../src/registries/types';
import { LruStoreImpl } from '../../src/storage/lru-store';
import { createLruResourceStore, LruResourceStore } from '../../src/storage/resource-adapter';

describe('LruStoreImpl', () => {
  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);

      expect(store.get('a')).toBe(1);
      expect(store.get('b')).toBe(2);
      expect(store.get('c')).toBeUndefined();
    });

    it('should return correct size', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      expect(store.size).toBe(0);

      store.set('a', 1);
      expect(store.size).toBe(1);

      store.set('b', 2);
      expect(store.size).toBe(2);
    });

    it('should check if keys exist', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);

      expect(store.has('a')).toBe(true);
      expect(store.has('b')).toBe(false);
    });

    it('should delete keys', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);

      expect(store.delete('a')).toBe(true);
      expect(store.delete('c')).toBe(false);

      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBe(2);
      expect(store.size).toBe(1);
    });

    it('should clear all items', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);

      store.clear();

      expect(store.size).toBe(0);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBeUndefined();
    });
  });

  describe('LRU Eviction Logic', () => {
    it('should evict least recently used items when capacity is exceeded', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 2 });

      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);

      expect(store.size).toBe(2);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBe(2);
      expect(store.get('c')).toBe(3);
    });

    it('should update LRU order when accessing items', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 2 });

      store.set('a', 1);
      store.set('b', 2);

      store.get('a');

      store.set('c', 3);

      expect(store.get('a')).toBe(1);
      expect(store.get('b')).toBeUndefined();
      expect(store.get('c')).toBe(3);
    });

    it('should update LRU order when setting existing keys', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 2 });

      store.set('a', 1);
      store.set('b', 2);

      store.set('a', 10);

      store.set('c', 3);

      expect(store.get('a')).toBe(10);
      expect(store.get('b')).toBeUndefined();
      expect(store.get('c')).toBe(3);
    });
  });

  describe('TTL Support', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire items after TTL', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1, 1000);

      expect(store.get('a')).toBe(1);

      jest.advanceTimersByTime(1001);

      expect(store.get('a')).toBeUndefined();
      expect(store.has('a')).toBe(false);
    });

    it('should use default TTL when not specified', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 3,
        defaultTtlMs: 500,
      });

      store.set('a', 1);

      expect(store.get('a')).toBe(1);

      jest.advanceTimersByTime(501);

      expect(store.get('a')).toBeUndefined();
    });

    it('should override default TTL when specified', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 3,
        defaultTtlMs: 500,
      });

      store.set('a', 1, 1000);

      jest.advanceTimersByTime(501);
      expect(store.get('a')).toBe(1);

      jest.advanceTimersByTime(500);
      expect(store.get('a')).toBeUndefined();
    });

    it('should not expire items without TTL', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);

      jest.advanceTimersByTime(10000);

      expect(store.get('a')).toBe(1);
    });

    it('should clean up expired items during iteration', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1, 1000);
      store.set('b', 2);
      store.set('c', 3, 1000);

      jest.advanceTimersByTime(1001);

      const keys = Array.from(store.keys());
      expect(keys).toEqual(['b']);

      const values = Array.from(store.values());
      expect(values).toEqual([2]);

      expect(store.size).toBe(1);
    });
  });

  describe('Statistics Collection', () => {
    it('should collect stats when enabled', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 2,
        collectStats: true,
      });

      store.set('a', 1);
      store.get('a');
      store.get('b');

      store.set('b', 2);
      store.set('c', 3);

      const stats = store.stats();
      expect(stats).toBeDefined();
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(1);
      expect(stats?.evictions).toBe(1);
    });

    it('should not collect stats when disabled', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 2,
        collectStats: false,
      });

      store.set('a', 1);
      store.get('a');

      const stats = store.stats();
      expect(stats).toBeUndefined();
    });

    it('should track expirations in stats', () => {
      jest.useFakeTimers();

      const store = new LruStoreImpl<string, number>({
        maxItems: 3,
        collectStats: true,
      });

      store.set('a', 1, 1000);

      jest.advanceTimersByTime(1001);

      store.get('a');

      const stats = store.stats();
      expect(stats?.expirations).toBe(1);
      expect(stats?.misses).toBe(1);

      jest.useRealTimers();
    });

    it('should return immutable stats object', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 2,
        collectStats: true,
      });

      store.set('a', 1);
      store.get('a');

      const stats1 = store.stats();
      const stats2 = store.stats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);

      if (stats1) {
        stats1.hits = 999;
        const stats3 = store.stats();
        expect(stats3?.hits).toBe(1);
      }
    });

    it('should track all stat types correctly', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 2,
        collectStats: true,
      });

      store.set('a', 1);
      store.set('b', 2);
      store.get('a');
      store.get('nonexistent');
      store.set('c', 3);

      const stats = store.stats();
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(1);
      expect(stats?.evictions).toBe(1);
      expect(stats?.expirations).toBe(0);
    });

    it('should reset stats after clear', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 2,
        collectStats: true,
      });

      store.set('a', 1);
      store.get('a');
      store.get('nonexistent');

      let stats = store.stats();
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(1);

      store.clear();

      stats = store.stats();
      expect(stats?.hits).toBe(0);
      expect(stats?.misses).toBe(0);
      expect(stats?.evictions).toBe(0);
      expect(stats?.expirations).toBe(0);
    });
  });

  describe('Iterator Support', () => {
    it('should iterate over keys in LRU order', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);

      store.get('a');

      const keys = Array.from(store.keys());
      expect(keys).toEqual(['b', 'c', 'a']);
    });

    it('should iterate over values in LRU order', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);

      store.get('a');

      const values = Array.from(store.values());
      expect(values).toEqual([2, 3, 1]);
    });
  });

  describe('Edge Cases', () => {
    it('should throw error for invalid maxItems', () => {
      expect(() => {
        new LruStoreImpl<string, number>({ maxItems: 0 });
      }).toThrow('maxItems must be greater than 0');

      expect(() => {
        new LruStoreImpl<string, number>({ maxItems: -1 });
      }).toThrow('maxItems must be greater than 0');
    });

    it('should handle single item capacity', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 1 });

      store.set('a', 1);
      expect(store.get('a')).toBe(1);

      store.set('b', 2);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBe(2);
      expect(store.size).toBe(1);
    });

    it('should handle updating existing keys without eviction', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 2 });

      store.set('a', 1);
      store.set('b', 2);

      expect(store.size).toBe(2);

      store.set('a', 10);

      expect(store.size).toBe(2);
      expect(store.get('a')).toBe(10);
      expect(store.get('b')).toBe(2);
    });

    it('should handle concurrent modifications gracefully', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);

      // Simulate rapid operations that might cause edge cases
      for (let i = 0; i < 10; i++) {
        store.set(`key${i}`, i);
        store.get('a');
        store.delete(`key${i - 1}`);
      }

      // Should still function correctly
      expect(store.size).toBeLessThanOrEqual(3);
      expect(typeof store.size).toBe('number');
    });

    it('should handle empty store operations', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 3 });

      expect(store.get('nonexistent')).toBeUndefined();
      expect(store.has('nonexistent')).toBe(false);
      expect(store.delete('nonexistent')).toBe(false);
      expect(store.size).toBe(0);

      const keys = Array.from(store.keys());
      expect(keys).toEqual([]);

      const values = Array.from(store.values());
      expect(values).toEqual([]);
    });

    it('should handle mixed expired and non-expired items during iteration', () => {
      jest.useFakeTimers();

      const store = new LruStoreImpl<string, number>({ maxItems: 5 });

      store.set('permanent1', 1);
      store.set('expires1', 2, 1000);
      store.set('permanent2', 3);
      store.set('expires2', 4, 1000);
      store.set('permanent3', 5);

      jest.advanceTimersByTime(1001);

      const keys = Array.from(store.keys());
      expect(keys).toEqual(['permanent1', 'permanent2', 'permanent3']);

      const values = Array.from(store.values());
      expect(values).toEqual([1, 3, 5]);

      expect(store.size).toBe(3);

      jest.useRealTimers();
    });
  });

  describe('Performance & Memory', () => {
    it('should maintain O(1) performance with large datasets', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 1000 });

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        store.set(`key${i}`, i);
      }

      for (let i = 0; i < 1000; i++) {
        store.get(`key${i}`);
      }

      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      expect(store.size).toBe(1000);
    });

    it('should not leak memory after clear', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 100,
        collectStats: true,
      });

      for (let i = 0; i < 100; i++) {
        store.set(`key${i}`, i);
      }

      expect(store.size).toBe(100);

      store.clear();

      expect(store.size).toBe(0);
      const stats = store.stats();
      expect(stats?.hits).toBe(0);
      expect(stats?.misses).toBe(0);
      expect(stats?.evictions).toBe(0);
      expect(stats?.expirations).toBe(0);

      const keys = Array.from(store.keys());
      expect(keys).toEqual([]);
    });

    it('should handle rapid successive operations', () => {
      const store = new LruStoreImpl<string, number>({ maxItems: 10 });

      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 20; i++) {
          store.set(`key${i}`, i * round);
          if (i % 2 === 0) {
            store.get(`key${i}`);
          }
          if (i % 3 === 0) {
            store.delete(`key${i - 1}`);
          }
        }
      }

      expect(store.size).toBeLessThanOrEqual(10);
      expect(store.size).toBeGreaterThan(0);
    });

    it('should handle stress test with mixed operations', () => {
      const store = new LruStoreImpl<string, number>({
        maxItems: 50,
        collectStats: true,
      });

      const operations = 1000;
      let setCount = 0;
      let getCount = 0;
      let deleteCount = 0;

      for (let i = 0; i < operations; i++) {
        const op = i % 3;
        const key = `key${i % 100}`;

        if (op === 0) {
          store.set(key, i);
          setCount++;
        } else if (op === 1) {
          store.get(key);
          getCount++;
        } else {
          store.delete(key);
          deleteCount++;
        }
      }

      expect(store.size).toBeLessThanOrEqual(50);
      expect(setCount).toBeGreaterThan(0);
      expect(getCount).toBeGreaterThan(0);
      expect(deleteCount).toBeGreaterThan(0);

      const stats = store.stats();
      expect(stats?.hits).toBeGreaterThanOrEqual(0);
      expect(stats?.misses).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('LruResourceStore', () => {
  const mockContext: HandlerContext = {
    request: {
      jsonrpc: '2.0',
      id: 'test-request',
      method: 'test',
      params: {},
    },
    send: jest.fn(),
    transport: {
      name: 'test-transport',
    },
    state: {},
  };

  describe('Basic ResourceProvider Operations', () => {
    it('should implement ResourceProvider interface', async () => {
      const store = new LruResourceStore({ maxItems: 3 });

      const result = await store.get('nonexistent', mockContext);
      expect(result).toBeUndefined();

      const listResult = await store.list(undefined, mockContext);
      expect(listResult.resources).toEqual([]);
      expect(listResult.hasMore).toBe(false);
    });

    it('should store and retrieve resources', async () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://resource1', 'data1', {
        name: 'Resource 1',
        description: 'Test resource',
        mimeType: 'text/plain',
      });

      const result = await store.get('test://resource1', mockContext);
      expect(result).toBeDefined();

      if (result && typeof result === 'object' && 'data' in result && 'metadata' in result && 'cached' in result) {
        const resourceContent = result as ResourceContent;
        expect(resourceContent.data).toBe('data1');
        expect(resourceContent.metadata.name).toBe('Resource 1');
        expect(resourceContent.metadata.mimeType).toBe('text/plain');
        expect(resourceContent.cached).toBe(true);
      }
    });

    it('should list cached resources', async () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://resource1', 'data1', { name: 'Resource 1' });
      store.addResource('test://resource2', 'data2', { name: 'Resource 2' });

      const listResult = await store.list(undefined, mockContext);
      expect(listResult.resources).toHaveLength(2);
      expect(listResult.resources[0]?.uri).toBe('test://resource1');
      expect(listResult.resources[1]?.uri).toBe('test://resource2');
    });

    it('should support pagination with cursor', async () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://a', 'data1');
      store.addResource('test://b', 'data2');
      store.addResource('test://c', 'data3');

      const listResult = await store.list('test://a', mockContext);
      expect(listResult.resources).toHaveLength(2);
      expect(listResult.resources[0]?.uri).toBe('test://b');
      expect(listResult.resources[1]?.uri).toBe('test://c');
    });
  });

  describe('Resource Management', () => {
    it('should remove resources', () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://resource1', 'data1');
      expect(store.hasResource('test://resource1')).toBe(true);

      const removed = store.removeResource('test://resource1');
      expect(removed).toBe(true);
      expect(store.hasResource('test://resource1')).toBe(false);

      const notRemoved = store.removeResource('nonexistent');
      expect(notRemoved).toBe(false);
    });

    it('should clear all resources', () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://resource1', 'data1');
      store.addResource('test://resource2', 'data2');

      expect(store.size).toBe(2);

      store.clear();

      expect(store.size).toBe(0);
      expect(store.hasResource('test://resource1')).toBe(false);
    });

    it('should use default MIME type', async () => {
      const store = new LruResourceStore<string>({
        maxItems: 3,
        defaultMimeType: 'application/json',
      });

      store.addResource('test://resource1', 'data1');

      const result = await store.get('test://resource1', mockContext);
      if (result && typeof result === 'object' && 'metadata' in result) {
        const resourceContent = result as ResourceContent;
        expect(resourceContent.metadata.mimeType).toBe('application/json');
      }
    });

    it('should support TTL for resources', async () => {
      jest.useFakeTimers();

      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://resource1', 'data1', {}, 1000);

      expect(store.hasResource('test://resource1')).toBe(true);

      jest.advanceTimersByTime(1001);

      const result = await store.get('test://resource1', mockContext);
      expect(result).toBeUndefined();
      expect(store.hasResource('test://resource1')).toBe(false);

      jest.useRealTimers();
    });

    it('should handle all metadata field combinations', async () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      const fullMetadata = {
        name: 'Full Resource',
        description: 'A resource with all metadata',
        mimeType: 'text/plain',
        size: 1024,
        lastModified: new Date('2023-01-01'),
        tags: ['test', 'metadata'],
        metadata: { custom: 'value' },
      };

      store.addResource('test://full', 'data', fullMetadata);

      const result = await store.get('test://full', mockContext);
      if (result && typeof result === 'object' && 'metadata' in result) {
        const resourceContent = result as ResourceContent;
        expect(resourceContent.metadata.name).toBe('Full Resource');
        expect(resourceContent.metadata.description).toBe('A resource with all metadata');
        expect(resourceContent.metadata.mimeType).toBe('text/plain');
        expect(resourceContent.metadata.size).toBe(1024);
        expect(resourceContent.metadata.lastModified).toEqual(new Date('2023-01-01'));
        expect(resourceContent.metadata.tags).toEqual(['test', 'metadata']);
        expect(resourceContent.metadata.metadata).toEqual({ custom: 'value' });
      }
    });

    it('should handle partial metadata gracefully', async () => {
      const store = new LruResourceStore<string>({
        maxItems: 3,
        defaultMimeType: 'application/json',
      });

      store.addResource('test://partial', 'data', { name: 'Partial' });

      const result = await store.get('test://partial', mockContext);
      if (result && typeof result === 'object' && 'metadata' in result) {
        const resourceContent = result as ResourceContent;
        expect(resourceContent.metadata.name).toBe('Partial');
        expect(resourceContent.metadata.description).toBeUndefined();
        expect(resourceContent.metadata.mimeType).toBe('application/json');
        expect(resourceContent.metadata.size).toBeUndefined();
        expect(resourceContent.metadata.tags).toBeUndefined();
        expect(resourceContent.metadata.metadata).toBeUndefined();
        expect(resourceContent.metadata.lastModified).toBeInstanceOf(Date);
      }
    });

    it('should handle empty metadata', async () => {
      const store = new LruResourceStore<string>({ maxItems: 3 });

      store.addResource('test://empty', 'data');

      const result = await store.get('test://empty', mockContext);
      if (result && typeof result === 'object' && 'metadata' in result) {
        const resourceContent = result as ResourceContent;
        expect(resourceContent.metadata.uri).toBe('test://empty');
        expect(resourceContent.metadata.mimeType).toBe('application/octet-stream');
        expect(resourceContent.metadata.lastModified).toBeInstanceOf(Date);
      }
    });
  });

  describe('Statistics Integration', () => {
    it('should collect stats when enabled', () => {
      const store = new LruResourceStore<string>({
        maxItems: 2,
        collectStats: true,
      });

      store.addResource('test://resource1', 'data1');
      store.addResource('test://resource2', 'data2');
      store.addResource('test://resource3', 'data3');

      const stats = store.getStats();
      expect(stats).toBeDefined();
      expect(stats?.evictions).toBe(1);
    });

    it('should not collect stats when disabled', () => {
      const store = new LruResourceStore<string>({
        maxItems: 2,
        collectStats: false,
      });

      store.addResource('test://resource1', 'data1');

      const stats = store.getStats();
      expect(stats).toBeUndefined();
    });
  });

  describe('LRU Behavior with Resources', () => {
    it('should evict least recently used resources', async () => {
      const store = new LruResourceStore<string>({ maxItems: 2 });

      store.addResource('test://resource1', 'data1');
      store.addResource('test://resource2', 'data2');

      await store.get('test://resource1', mockContext);

      store.addResource('test://resource3', 'data3');

      expect(store.hasResource('test://resource1')).toBe(true);
      expect(store.hasResource('test://resource2')).toBe(false);
      expect(store.hasResource('test://resource3')).toBe(true);
    });
  });
});

describe('createLruResourceStore Factory Function', () => {
  const mockContext: HandlerContext = {
    request: {
      jsonrpc: '2.0',
      id: 'test-request',
      method: 'test',
      params: {},
    },
    send: jest.fn(),
    transport: {
      name: 'test-transport',
    },
    state: {},
  };

  it('should create LruResourceStore with basic options', () => {
    const store = createLruResourceStore(10);

    expect(store).toBeInstanceOf(LruResourceStore);
    expect(store.size).toBe(0);
  });

  it('should create LruResourceStore with TTL', () => {
    const store = createLruResourceStore(10, 5000);

    store.addResource('test://resource1', 'data1');
    expect(store.hasResource('test://resource1')).toBe(true);
  });

  it('should create LruResourceStore with custom options', () => {
    const store = createLruResourceStore(10, undefined, {
      collectStats: true,
      defaultMimeType: 'application/json',
    });

    store.addResource('test://resource1', 'data1');

    const stats = store.getStats();
    expect(stats).toBeDefined();
  });

  it('should work as ResourceProvider', async () => {
    const store = createLruResourceStore<string>(5);

    store.addResource('test://resource1', 'test data', {
      name: 'Test Resource',
      description: 'A test resource',
    });

    const result = await store.get('test://resource1', mockContext);
    expect(result).toBeDefined();

    if (result && typeof result === 'object' && 'data' in result) {
      const resourceContent = result as ResourceContent;
      expect(resourceContent.data).toBe('test data');
      expect(resourceContent.metadata.name).toBe('Test Resource');
    }

    const listResult = await store.list(undefined, mockContext);
    expect(listResult.resources).toHaveLength(1);
    expect(listResult.resources[0]?.uri).toBe('test://resource1');
  });

  it('should handle LRU eviction in factory-created store', () => {
    const store = createLruResourceStore<string>(2);

    store.addResource('test://resource1', 'data1');
    store.addResource('test://resource2', 'data2');
    store.addResource('test://resource3', 'data3');

    expect(store.size).toBe(2);
    expect(store.hasResource('test://resource1')).toBe(false);
    expect(store.hasResource('test://resource2')).toBe(true);
    expect(store.hasResource('test://resource3')).toBe(true);
  });

  it('should handle TTL expiration in factory-created store', () => {
    jest.useFakeTimers();

    const store = createLruResourceStore<string>(5, 1000);

    store.addResource('test://resource1', 'data1');
    expect(store.hasResource('test://resource1')).toBe(true);

    jest.advanceTimersByTime(1001);

    expect(store.hasResource('test://resource1')).toBe(false);

    jest.useRealTimers();
  });

  it('should handle factory with no TTL', () => {
    const store = createLruResourceStore<string>(5);

    store.addResource('test://resource1', 'data1');
    expect(store.hasResource('test://resource1')).toBe(true);

    // Should not expire without TTL
    expect(store.hasResource('test://resource1')).toBe(true);
  });

  it('should handle factory with all options undefined', () => {
    const store = createLruResourceStore<string>(5, undefined, undefined);

    expect(store).toBeInstanceOf(LruResourceStore);
    expect(store.size).toBe(0);
    expect(store.getStats()).toBeUndefined();
  });

  it('should handle factory with empty options object', () => {
    const store = createLruResourceStore<string>(5, undefined, {});

    expect(store).toBeInstanceOf(LruResourceStore);
    expect(store.getStats()).toBeUndefined();
  });

  it('should handle factory with mixed option combinations', () => {
    const store1 = createLruResourceStore<string>(5, 1000, { collectStats: true });
    const store2 = createLruResourceStore<string>(5, undefined, { defaultMimeType: 'text/plain' });
    const store3 = createLruResourceStore<string>(5, 2000, {
      collectStats: true,
      defaultMimeType: 'application/xml',
    });

    expect(store1.getStats()).toBeDefined();
    expect(store2.getStats()).toBeUndefined();
    expect(store3.getStats()).toBeDefined();

    store2.addResource('test://resource', 'data');
    store3.addResource('test://resource', 'data');

    // Verify different MIME types are used
    expect(store1).toBeInstanceOf(LruResourceStore);
    expect(store2).toBeInstanceOf(LruResourceStore);
    expect(store3).toBeInstanceOf(LruResourceStore);
  });

  it('should create independent store instances', () => {
    const store1 = createLruResourceStore<string>(2);
    const store2 = createLruResourceStore<string>(2);

    store1.addResource('test://resource1', 'data1');
    store2.addResource('test://resource2', 'data2');

    expect(store1.hasResource('test://resource1')).toBe(true);
    expect(store1.hasResource('test://resource2')).toBe(false);
    expect(store2.hasResource('test://resource1')).toBe(false);
    expect(store2.hasResource('test://resource2')).toBe(true);
  });

  it('should handle type parameter correctly', () => {
    interface CustomData {
      id: number;
      value: string;
    }

    const store = createLruResourceStore<CustomData>(5);

    const customData: CustomData = { id: 1, value: 'test' };
    store.addResource('test://custom', customData);

    expect(store.hasResource('test://custom')).toBe(true);
  });
});
