import {
  COMMON_ERROR_CODES,
  createErrorFixture,
  createNotificationFixture,
  createSuccessFixture,
  FixtureCategory,
  FixtureDefinitionSchema,
  isValidFixture,
  validateFixture,
  validateFixtures,
} from '../src/index.js';

describe('Fixture Schema Validation', () => {
  describe('FixtureDefinitionSchema', () => {
    it('should validate a valid success fixture', () => {
      const fixture = createSuccessFixture('test-ping', 'Test ping request', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      expect(() => FixtureDefinitionSchema.parse(fixture)).not.toThrow();
    });

    it('should validate a valid error fixture', () => {
      const fixture = createErrorFixture(
        'test-method-not-found',
        'Test method not found error',
        FixtureCategory.ERRORS,
        'invalid/method',
        {},
        COMMON_ERROR_CODES.METHOD_NOT_FOUND,
        'Method not found'
      );

      expect(() => FixtureDefinitionSchema.parse(fixture)).not.toThrow();
    });

    it('should validate a valid notification fixture', () => {
      const fixture = createNotificationFixture(
        'test-progress',
        'Test progress notification',
        FixtureCategory.STREAMING,
        'notifications/progress',
        {
          progressToken: 'test',
          progress: 0.5,
        }
      );

      expect(() => FixtureDefinitionSchema.parse(fixture)).not.toThrow();
    });

    it('should reject fixture with invalid name format', () => {
      const fixture = createSuccessFixture(
        'Test_Invalid_Name',
        'Test with invalid name',
        FixtureCategory.BASIC,
        'ping',
        {},
        { pong: true }
      );

      expect(() => FixtureDefinitionSchema.parse(fixture)).toThrow('Name must be kebab-case');
    });

    it('should reject fixture with mismatched expected type and response', () => {
      const fixture = {
        name: 'test-mismatch',
        description: 'Test mismatched type',
        category: 'basic',
        input: {
          jsonrpc: '2.0' as const,
          id: 'test',
          method: 'ping',
        },
        expected: {
          type: 'success' as const,
          // Missing response for success type
        },
      };

      expect(() => FixtureDefinitionSchema.parse(fixture)).toThrow('Expected response must match the specified type');
    });

    it('should reject notification with non-null id expecting non-error response', () => {
      const fixture = {
        name: 'test-invalid-notification',
        description: 'Test invalid notification',
        category: 'basic',
        input: {
          jsonrpc: '2.0' as const,
          id: null,
          method: 'ping',
        },
        expected: {
          type: 'success' as const,
          response: {
            jsonrpc: '2.0' as const,
            id: null,
            result: { pong: true },
          },
        },
      };

      expect(() => FixtureDefinitionSchema.parse(fixture)).toThrow('Requests with null id should only expect notifications or errors');
    });
  });

  describe('validateFixture', () => {
    it('should return parsed fixture for valid input', () => {
      const fixture = createSuccessFixture('test-valid', 'Test valid fixture', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      const result = validateFixture(fixture);
      expect(result).toEqual(fixture);
    });

    it('should throw for invalid input', () => {
      const invalidFixture = {
        name: 'invalid',
        // Missing required fields
      };

      expect(() => validateFixture(invalidFixture)).toThrow();
    });
  });

  describe('validateFixtures', () => {
    it('should validate array of valid fixtures', () => {
      const fixtures = [
        createSuccessFixture('test-1', 'Test 1', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        createErrorFixture('test-2', 'Test 2', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Method not found'),
      ];

      const result = validateFixtures(fixtures);
      expect(result).toEqual(fixtures);
    });

    it('should throw with index information for invalid fixture', () => {
      const fixtures = [
        createSuccessFixture('test-1', 'Test 1', FixtureCategory.BASIC, 'ping', {}, { pong: true }),
        { invalid: 'fixture' },
      ];

      expect(() => validateFixtures(fixtures)).toThrow('Fixture at index 1 is invalid');
    });
  });

  describe('isValidFixture', () => {
    it('should return true for valid fixture', () => {
      const fixture = createSuccessFixture('test-valid', 'Test valid fixture', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      expect(isValidFixture(fixture)).toBe(true);
    });

    it('should return false for invalid fixture', () => {
      const invalidFixture = {
        name: 'invalid',
        // Missing required fields
      };

      expect(isValidFixture(invalidFixture)).toBe(false);
    });
  });
});
