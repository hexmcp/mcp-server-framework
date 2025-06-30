import type { Registry } from '../../src/registries/base';

describe('Registry Interface', () => {
  it('should define the required interface structure', () => {
    const mockRegistry: Registry = {
      kind: 'test',
      getCapabilities: () => ({}),
    };

    expect(mockRegistry.kind).toBe('test');
    expect(typeof mockRegistry.getCapabilities).toBe('function');
    expect(mockRegistry.getCapabilities()).toEqual({});
  });
});
