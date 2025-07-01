import { z } from 'zod';
import type { FixtureDefinition } from './fixture-types.js';

export const FixtureCategorySchema = z.enum(['basic', 'auth', 'lifecycle', 'streaming', 'registries', 'errors', 'performance']);

export const FixtureExpectedTypeSchema = z.enum(['success', 'error', 'stream', 'notification']);

export const FixtureLifecycleStateSchema = z.enum(['idle', 'initializing', 'ready', 'shutting-down']);

export const FixtureInputSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export const FixtureExpectedResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
});

export const FixtureExpectedErrorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

export const FixtureProgressNotificationSchema = z.object({
  progressToken: z.string(),
  progress: z.number().min(0).max(1),
  total: z.number(),
});

export const FixtureExpectedStreamSchema = z.object({
  chunks: z.array(z.unknown()),
  complete: z.boolean(),
  progressNotifications: z.array(FixtureProgressNotificationSchema).optional(),
});

export const FixtureExpectedSchema = z.object({
  type: FixtureExpectedTypeSchema,
  response: FixtureExpectedResponseSchema.optional(),
  error: FixtureExpectedErrorSchema.optional(),
  stream: FixtureExpectedStreamSchema.optional(),
  timeout: z.number().positive().optional(),
});

export const FixtureEnvironmentSchema = z.object({
  debugMode: z.boolean().optional(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  variables: z.record(z.string()).optional(),
});

export const FixtureSetupSchema = z.object({
  middleware: z.array(z.string()).optional(),
  registries: z.array(z.string()).optional(),
  capabilities: z.record(z.unknown()).optional(),
  state: z.record(z.unknown()).optional(),
});

export const FixtureTeardownSchema = z.object({
  cleanup: z.boolean().optional(),
  resetState: z.boolean().optional(),
});

export const FixtureMetadataSchema = z.object({
  requiresAuth: z.boolean().optional(),
  lifecycleState: FixtureLifecycleStateSchema.optional(),
  timeout: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  setup: FixtureSetupSchema.optional(),
  teardown: FixtureTeardownSchema.optional(),
  dependencies: z.array(z.string()).optional(),
  skipReason: z.string().optional(),
  environment: FixtureEnvironmentSchema.optional(),
});

export const FixtureDefinitionSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Name must be kebab-case'),
    description: z.string().min(1),
    category: FixtureCategorySchema,
    input: FixtureInputSchema,
    expected: FixtureExpectedSchema,
    metadata: FixtureMetadataSchema.optional(),
    version: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.expected.type === 'success' && !data.expected.response) {
        return false;
      }
      if (data.expected.type === 'error' && !data.expected.error) {
        return false;
      }
      if (data.expected.type === 'stream' && !data.expected.stream) {
        return false;
      }
      return true;
    },
    {
      message: 'Expected response must match the specified type',
    }
  )
  .refine(
    (data) => {
      if (data.input.id === null && data.expected.type !== 'notification') {
        return data.expected.type === 'error';
      }
      return true;
    },
    {
      message: 'Requests with null id should only expect notifications or errors',
    }
  );

export function validateFixture(fixture: unknown): FixtureDefinition {
  return FixtureDefinitionSchema.parse(fixture) as FixtureDefinition;
}

export function validateFixtures(fixtures: unknown[]): FixtureDefinition[] {
  return fixtures.map((fixture, index) => {
    try {
      return validateFixture(fixture);
    } catch (error) {
      throw new Error(`Fixture at index ${index} is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

export function isValidFixture(fixture: unknown): fixture is FixtureDefinition {
  try {
    validateFixture(fixture);
    return true;
  } catch {
    return false;
  }
}
