import type { TransportRegistry } from './registry';
import type { TransportDispatch } from './types';

/**
 * Transport orchestration error that aggregates individual transport failures.
 *
 * This error type provides detailed information about which transports failed
 * during orchestration operations, enabling proper error handling and recovery.
 */
export class TransportOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly failures: Array<{ transport: string; error: Error }>
  ) {
    super(message);
    this.name = 'TransportOrchestrationError';
  }
}

/**
 * Start all transports registered in the provided registry.
 *
 * This function iterates through all registered transports and attempts to start
 * each one with the provided dispatch function. It implements a "continue on failure"
 * strategy where individual transport failures don't prevent other transports from
 * starting, but all failures are collected and reported.
 *
 * Error Handling Strategy:
 * - Individual transport start failures are caught and collected
 * - Other transports continue to start regardless of individual failures
 * - If any failures occur, a TransportOrchestrationError is thrown with details
 * - If all transports fail, the error contains information about all failures
 *
 * Future Integration Points:
 * - Server Lifecycle: Called during server.start() to initialize all transports
 * - Builder DSL: Will be called after builder.build() to start configured transports
 * - Health Checks: Future health monitoring will track transport start success/failure
 * - Metrics: Future metrics collection will track transport startup times and failures
 *
 * TODO: Add support for parallel vs sequential startup strategies
 * TODO: Add timeout handling for transport startup
 * TODO: Add retry logic for failed transport starts
 * TODO: Add startup progress callbacks for monitoring
 *
 * @param registry - The TransportRegistry containing transports to start
 * @param dispatch - The dispatch function to pass to each transport
 * @throws {TransportOrchestrationError} If any transports fail to start
 * @throws {Error} If registry is null/undefined or dispatch is not a function
 *
 * @example
 * ```typescript
 * const registry = new TransportRegistry();
 * registry.registerTransport(new StdioTransport());
 * registry.registerTransport(new HttpTransport());
 *
 * const dispatch = (message, respond, metadata) => {
 *   // Handle message
 *   respond({ result: "processed" });
 * };
 *
 * try {
 *   await startAllTransports(registry, dispatch);
 *   logger.info('All transports started successfully', {
 *     transportCount: registry.size()
 *   });
 * } catch (error) {
 *   if (error instanceof TransportOrchestrationError) {
 *     logger.error('Some transports failed to start', {
 *       failures: error.failures,
 *       failureCount: error.failures.length
 *     });
 *   }
 * }
 *
 * // Future server integration:
 * // server.start() -> startAllTransports(server.registry, server.dispatch)
 * ```
 */
export async function startAllTransports(registry: TransportRegistry, dispatch: TransportDispatch): Promise<void> {
  if (!registry) {
    throw new Error('Registry cannot be null or undefined');
  }

  if (typeof dispatch !== 'function') {
    throw new Error('Dispatch must be a function');
  }

  const transports = registry.getTransports();
  const failures: Array<{ transport: string; error: Error }> = [];

  // TODO: Consider parallel startup for better performance
  // TODO: Add configurable timeout for each transport start
  // TODO: Add startup progress reporting
  for (const transport of transports) {
    try {
      await transport.start(dispatch);
    } catch (error) {
      failures.push({
        transport: transport.name,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (failures.length > 0) {
    const successCount = transports.length - failures.length;
    throw new TransportOrchestrationError(
      `Failed to start ${failures.length} of ${transports.length} transports (${successCount} succeeded)`,
      failures
    );
  }
}

/**
 * Stop all transports registered in the provided registry.
 *
 * This function iterates through all registered transports and attempts to stop
 * each one gracefully. It implements a "continue on failure" strategy where
 * individual transport stop failures don't prevent other transports from stopping,
 * but all failures are collected and reported.
 *
 * Error Handling Strategy:
 * - Individual transport stop failures are caught and collected
 * - Other transports continue to stop regardless of individual failures
 * - If any failures occur, a TransportOrchestrationError is thrown with details
 * - Best effort is made to stop all transports even if some fail
 *
 * Future Integration Points:
 * - Server Lifecycle: Called during server.stop() to gracefully shutdown all transports
 * - Signal Handlers: Called during SIGTERM/SIGINT for graceful shutdown
 * - Health Checks: Future health monitoring will track transport stop success/failure
 * - Resource Cleanup: Future resource management will ensure proper cleanup
 *
 * TODO: Add support for parallel vs sequential shutdown strategies
 * TODO: Add timeout handling for transport shutdown
 * TODO: Add forced shutdown after timeout
 * TODO: Add shutdown progress callbacks for monitoring
 *
 * @param registry - The TransportRegistry containing transports to stop
 * @throws {TransportOrchestrationError} If any transports fail to stop
 * @throws {Error} If registry is null/undefined
 *
 * @example
 * ```typescript
 * try {
 *   await stopAllTransports(registry);
 *   logger.info('All transports stopped successfully', {
 *     transportCount: registry.size()
 *   });
 * } catch (error) {
 *   if (error instanceof TransportOrchestrationError) {
 *     logger.error('Some transports failed to stop', {
 *       failures: error.failures,
 *       failureCount: error.failures.length
 *     });
 *   }
 * }
 *
 * // Future server integration:
 * // server.stop() -> stopAllTransports(server.registry)
 * ```
 */
export async function stopAllTransports(registry: TransportRegistry): Promise<void> {
  if (!registry) {
    throw new Error('Registry cannot be null or undefined');
  }

  const transports = registry.getTransports();
  const failures: Array<{ transport: string; error: Error }> = [];

  // TODO: Consider parallel shutdown for better performance
  // TODO: Add configurable timeout for each transport stop
  // TODO: Add forced shutdown after timeout
  // TODO: Add shutdown progress reporting
  for (const transport of transports) {
    try {
      await transport.stop();
    } catch (error) {
      failures.push({
        transport: transport.name,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (failures.length > 0) {
    const successCount = transports.length - failures.length;
    throw new TransportOrchestrationError(
      `Failed to stop ${failures.length} of ${transports.length} transports (${successCount} succeeded)`,
      failures
    );
  }
}
