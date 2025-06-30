import { McpCapabilityRegistry, MockPrimitiveRegistry } from '../../src/lifecycle/index';

describe('McpCapabilityRegistry', () => {
  let capabilityRegistry: McpCapabilityRegistry;
  let primitiveRegistry: MockPrimitiveRegistry;

  beforeEach(() => {
    primitiveRegistry = new MockPrimitiveRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
  });

  describe('default capabilities', () => {
    it('should have default capabilities', () => {
      const capabilities = capabilityRegistry.getServerCapabilities();

      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
      });
    });

    it('should accept initial capabilities', () => {
      const registry = new McpCapabilityRegistry({
        prompts: {},
        tools: {},
      });

      const capabilities = registry.getServerCapabilities();
      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        prompts: {},
        tools: {},
      });
    });
  });

  describe('static capability management', () => {
    it('should update capabilities', () => {
      capabilityRegistry.updateCapabilities({
        prompts: {},
        tools: {},
      });

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        prompts: {},
        tools: {},
      });
    });

    it('should check for capability existence', () => {
      expect(capabilityRegistry.hasCapability('prompts')).toBe(false);

      capabilityRegistry.enablePrompts();
      expect(capabilityRegistry.hasCapability('prompts')).toBe(true);
    });

    it('should enable specific capabilities', () => {
      capabilityRegistry.enablePrompts();
      capabilityRegistry.enableTools();
      capabilityRegistry.enableResources({ subscribe: true, listChanged: true });
      capabilityRegistry.enableCompletion();
      capabilityRegistry.enableLogging();

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        prompts: {},
        tools: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
        completion: {},
      });
    });

    it('should disable capabilities', () => {
      capabilityRegistry.enablePrompts();
      expect(capabilityRegistry.hasCapability('prompts')).toBe(true);

      capabilityRegistry.disableCapability('prompts');
      expect(capabilityRegistry.hasCapability('prompts')).toBe(false);
    });
  });

  describe('dynamic capability management', () => {
    beforeEach(() => {
      capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    });

    it('should add prompts capability when prompts are registered', () => {
      primitiveRegistry.setPromptCount(1);

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities.prompts).toBeDefined();
    });

    it('should add tools capability when tools are registered', () => {
      primitiveRegistry.setToolCount(1);

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities.tools).toBeDefined();
    });

    it('should add resources capability when resources are registered', () => {
      primitiveRegistry.setResourceCount(1);

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.resources).toMatchObject({
        subscribe: false,
        listChanged: false,
      });
    });

    it('should not add capabilities when no primitives are registered', () => {
      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities.prompts).toBeUndefined();
      expect(capabilities.tools).toBeUndefined();
      expect(capabilities.resources).toBeUndefined();
    });

    it('should combine static and dynamic capabilities', () => {
      capabilityRegistry.enableCompletion();
      primitiveRegistry.setPromptCount(1);
      primitiveRegistry.setToolCount(1);

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities).toMatchObject({
        experimental: {},
        logging: {},
        completion: {},
        prompts: {},
        tools: {},
      });
    });

    it('should prefer static over dynamic capabilities', () => {
      capabilityRegistry.enableResources({ subscribe: true, listChanged: true });
      primitiveRegistry.setResourceCount(1);

      const capabilities = capabilityRegistry.getServerCapabilities();
      expect(capabilities.resources).toMatchObject({
        subscribe: true,
        listChanged: true,
      });
    });
  });

  describe('capability summary', () => {
    beforeEach(() => {
      capabilityRegistry.setPrimitiveRegistry(primitiveRegistry);
    });

    it('should provide capability summary with static capabilities only', () => {
      capabilityRegistry.enablePrompts();
      capabilityRegistry.enableTools();

      const summary = capabilityRegistry.getCapabilitySummary();
      expect(summary).toMatchObject({
        static: expect.arrayContaining(['experimental', 'logging', 'prompts', 'tools']),
        dynamic: [],
        total: 4,
      });
    });

    it('should provide capability summary with dynamic capabilities', () => {
      primitiveRegistry.setResourceCount(1);

      const summary = capabilityRegistry.getCapabilitySummary();
      expect(summary).toMatchObject({
        static: ['experimental', 'logging'],
        dynamic: ['resources'],
        total: 3,
      });
    });

    it('should not double-count static and dynamic capabilities', () => {
      capabilityRegistry.enablePrompts();
      primitiveRegistry.setPromptCount(1);
      primitiveRegistry.setToolCount(1);

      const summary = capabilityRegistry.getCapabilitySummary();
      expect(summary).toMatchObject({
        static: expect.arrayContaining(['experimental', 'logging', 'prompts']),
        dynamic: ['tools'],
        total: 4,
      });
    });
  });
});

describe('MockPrimitiveRegistry', () => {
  let registry: MockPrimitiveRegistry;

  beforeEach(() => {
    registry = new MockPrimitiveRegistry();
  });

  it('should start with zero counts', () => {
    expect(registry.getPromptCount()).toBe(0);
    expect(registry.getToolCount()).toBe(0);
    expect(registry.getResourceCount()).toBe(0);
    expect(registry.hasPrompts()).toBe(false);
    expect(registry.hasTools()).toBe(false);
    expect(registry.hasResources()).toBe(false);
  });

  it('should update counts correctly', () => {
    registry.setPromptCount(5);
    registry.setToolCount(3);
    registry.setResourceCount(2);

    expect(registry.getPromptCount()).toBe(5);
    expect(registry.getToolCount()).toBe(3);
    expect(registry.getResourceCount()).toBe(2);
    expect(registry.hasPrompts()).toBe(true);
    expect(registry.hasTools()).toBe(true);
    expect(registry.hasResources()).toBe(true);
  });
});
