import { v4 as uuidv4, validate as validateUuid } from 'uuid';

/**
 * Generates a real UUID v4 using the standard uuid package.
 * This is preferred over simple incrementing numbers for realistic testing.
 *
 * @returns A valid UUID v4 string
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Generates a sequence of unique UUIDs for testing scenarios that need multiple IDs.
 *
 * @param count - Number of UUIDs to generate
 * @returns Array of unique UUID strings
 */
export function generateUuids(count: number): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateUuid());
  }
  return uuids;
}

/**
 * Creates a deterministic UUID-like string for testing scenarios where
 * reproducible IDs are needed. Uses a simple counter-based approach.
 *
 * @param seed - Seed value for deterministic generation
 * @returns A UUID-like string that's deterministic based on the seed
 */
export function generateDeterministicUuid(seed: number): string {
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-000000000000`;
}

/**
 * Validates that a string is a properly formatted UUID.
 *
 * @param uuid - String to validate
 * @returns True if the string is a valid UUID
 */
export function isValidUuid(uuid: string): boolean {
  return validateUuid(uuid);
}

/**
 * Creates a UUID generator that produces deterministic UUIDs for testing.
 * Useful when you need reproducible test results.
 *
 * @param startSeed - Starting seed value (defaults to 1)
 * @returns A function that generates deterministic UUIDs
 */
export function createDeterministicUuidGenerator(startSeed = 1): () => string {
  let counter = startSeed;
  return () => generateDeterministicUuid(counter++);
}

/**
 * Creates a UUID generator that produces real random UUIDs.
 *
 * @returns A function that generates random UUIDs
 */
export function createUuidGenerator(): () => string {
  return generateUuid;
}

/**
 * Utility for creating request IDs in tests. Can be configured to use
 * either real UUIDs or deterministic IDs based on testing needs.
 */
export class RequestIdGenerator {
  private generator: () => string;
  private isDeterministic: boolean;
  private startSeed: number;

  constructor(deterministic = false, startSeed = 1) {
    this.isDeterministic = deterministic;
    this.startSeed = startSeed;
    this.generator = deterministic ? createDeterministicUuidGenerator(startSeed) : createUuidGenerator();
  }

  /**
   * Generates the next request ID.
   */
  next(): string {
    return this.generator();
  }

  /**
   * Generates multiple request IDs.
   */
  nextBatch(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.next());
    }
    return ids;
  }

  /**
   * Resets the generator (only applicable for deterministic generators).
   */
  reset(startSeed?: number): void {
    if (this.isDeterministic) {
      const seed = startSeed ?? this.startSeed;
      this.startSeed = seed;
      this.generator = createDeterministicUuidGenerator(seed);
    }
  }
}

/**
 * Default request ID generator for testing. Uses deterministic IDs by default
 * for reproducible tests, but can be configured to use real UUIDs.
 */
export const defaultRequestIdGenerator = new RequestIdGenerator(true);

/**
 * Real UUID generator for testing scenarios that need actual random UUIDs.
 */
export const realUuidGenerator = new RequestIdGenerator(false);

/**
 * Counter to ensure unique mock UUIDs
 */
let mockUuidCounter = 0;

/**
 * Utility functions for common UUID testing patterns.
 */
export const UuidTestUtils = {
  /**
   * Creates a mock UUID that follows the format but uses predictable values.
   */
  createMockUuid: (prefix = 'test'): string => {
    const timestamp = (Date.now() + mockUuidCounter++).toString(16).padStart(12, '0');
    return `${prefix.padEnd(8, '0').substring(0, 8)}-${timestamp.substring(0, 4)}-4${timestamp.substring(4, 7)}-8${timestamp.substring(7, 10)}-${timestamp.substring(10, 12)}0000000000`;
  },

  /**
   * Extracts the timestamp portion from a mock UUID created with createMockUuid.
   */
  extractTimestamp: (mockUuid: string): number => {
    const parts = mockUuid.split('-');
    if (parts.length < 5) {
      throw new Error('Invalid mock UUID format');
    }
    const timestampHex =
      (parts[1] || '') + (parts[2]?.substring(1) || '') + (parts[3]?.substring(1) || '') + (parts[4]?.substring(0, 2) || '');
    return parseInt(timestampHex, 16);
  },

  /**
   * Creates a batch of mock UUIDs with sequential timestamps.
   */
  createMockUuidBatch: (count: number, prefix = 'test'): string[] => {
    const baseTime = Date.now();
    const uuids: string[] = [];
    for (let i = 0; i < count; i++) {
      const timestamp = (baseTime + i).toString(16).padStart(12, '0');
      const uuid = `${prefix.padEnd(8, '0').substring(0, 8)}-${timestamp.substring(0, 4)}-4${timestamp.substring(4, 7)}-8${timestamp.substring(7, 10)}-${timestamp.substring(10, 12)}0000000000`;
      uuids.push(uuid);
    }
    return uuids;
  },

  /**
   * Validates that a collection of UUIDs are all unique.
   */
  areAllUnique: (uuids: string[]): boolean => {
    const uniqueSet = new Set(uuids);
    return uniqueSet.size === uuids.length;
  },

  /**
   * Validates that all UUIDs in a collection are properly formatted.
   */
  areAllValid: (uuids: string[]): boolean => {
    return uuids.every(isValidUuid);
  },
};
