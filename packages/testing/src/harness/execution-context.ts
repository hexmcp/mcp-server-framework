import type {
  McpCapabilityRegistry,
  McpLifecycleManager,
  McpRequestGate,
  MockPrimitiveRegistry,
} from '../../../core/src/lifecycle/index.js';
import type { FixtureDefinition } from '../types/fixture-types.js';
import { VALID_INITIALIZE_REQUEST_WITH_ID } from './test-fixtures.js';

export interface FixtureExecutionContextOptions {
  lifecycleManager: McpLifecycleManager;
  capabilityRegistry: McpCapabilityRegistry;
  primitiveRegistry: MockPrimitiveRegistry;
  requestGate: McpRequestGate;
  enableLogging?: boolean;
  debugMode?: boolean;
}

export class FixtureExecutionContext {
  private isSetup = false;

  constructor(
    private fixture: FixtureDefinition,
    private options: FixtureExecutionContextOptions
  ) {}

  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    await this.setupLifecycleState();
    this.setupCapabilities();
    this.setupPrimitiveRegistry();

    this.isSetup = true;
  }

  async teardown(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    await this.resetLifecycleState();
    this.resetCapabilities();
    this.resetPrimitiveRegistry();

    this.isSetup = false;
  }

  private async setupLifecycleState(): Promise<void> {
    const { lifecycleManager } = this.options;
    const requiredState = this.fixture.metadata?.lifecycleState || 'ready';

    if (requiredState === 'ready') {
      if (lifecycleManager.currentState === 'idle') {
        await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      }
    } else if (requiredState === 'idle') {
      if (lifecycleManager.currentState !== 'idle') {
        await lifecycleManager.shutdown('Test fixture requires idle state');
      }
    } else if (requiredState === 'initializing') {
      if (lifecycleManager.currentState === 'idle') {
        await lifecycleManager.initialize(VALID_INITIALIZE_REQUEST_WITH_ID);
      }
    }
  }

  private setupCapabilities(): void {
    const { capabilityRegistry } = this.options;
    const setup = this.fixture.metadata?.setup;

    if (setup?.capabilities) {
      capabilityRegistry.updateCapabilities(setup.capabilities);
    }
  }

  private setupPrimitiveRegistry(): void {
    const { primitiveRegistry } = this.options;
    const setup = this.fixture.metadata?.setup;

    if (setup?.registries) {
      for (const registry of setup.registries) {
        switch (registry) {
          case 'prompts':
            primitiveRegistry.setPromptCount(1);
            break;
          case 'tools':
            primitiveRegistry.setToolCount(1);
            break;
          case 'resources':
            primitiveRegistry.setResourceCount(1);
            break;
        }
      }
    }
  }

  private async resetLifecycleState(): Promise<void> {
    const { lifecycleManager } = this.options;

    if (lifecycleManager.currentState !== 'idle') {
      await lifecycleManager.shutdown('Test fixture cleanup');
    }
  }

  private resetCapabilities(): void {
    const { capabilityRegistry } = this.options;

    capabilityRegistry.updateCapabilities({
      experimental: {},
      logging: {},
    });
  }

  private resetPrimitiveRegistry(): void {
    const { primitiveRegistry } = this.options;

    primitiveRegistry.setPromptCount(0);
    primitiveRegistry.setToolCount(0);
    primitiveRegistry.setResourceCount(0);
  }
}
