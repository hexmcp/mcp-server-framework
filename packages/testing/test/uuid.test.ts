import {
  createDeterministicUuidGenerator,
  createUuidGenerator,
  defaultRequestIdGenerator,
  generateDeterministicUuid,
  generateUuid,
  generateUuids,
  isValidUuid,
  RequestIdGenerator,
  realUuidGenerator,
  UuidTestUtils,
} from '../src/uuid';

describe('UUID Generation', () => {
  describe('generateUuid', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUuid();
      expect(isValidUuid(uuid)).toBe(true);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUuid();
      const uuid2 = generateUuid();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate UUIDs with correct version and variant bits', () => {
      const uuid = generateUuid();
      const parts = uuid.split('-');

      // Version should be 4
      expect(parts[2]?.[0]).toBe('4');

      // Variant should be 8, 9, a, or b
      expect(['8', '9', 'a', 'b']).toContain(parts[3]?.[0]?.toLowerCase());
    });
  });

  describe('generateUuids', () => {
    it('should generate the requested number of UUIDs', () => {
      const uuids = generateUuids(5);
      expect(uuids).toHaveLength(5);
    });

    it('should generate unique UUIDs in batch', () => {
      const uuids = generateUuids(10);
      const uniqueSet = new Set(uuids);
      expect(uniqueSet.size).toBe(10);
    });

    it('should generate valid UUIDs in batch', () => {
      const uuids = generateUuids(3);
      uuids.forEach((uuid) => {
        expect(isValidUuid(uuid)).toBe(true);
      });
    });
  });

  describe('generateDeterministicUuid', () => {
    it('should generate deterministic UUIDs', () => {
      const uuid1 = generateDeterministicUuid(123);
      const uuid2 = generateDeterministicUuid(123);
      expect(uuid1).toBe(uuid2);
    });

    it('should generate different UUIDs for different seeds', () => {
      const uuid1 = generateDeterministicUuid(123);
      const uuid2 = generateDeterministicUuid(456);
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate UUID-like format', () => {
      const uuid = generateDeterministicUuid(123);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('isValidUuid', () => {
    it('should validate correct UUID v4', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUuid(validUuid)).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // Wrong length
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000g')).toBe(false); // Invalid character
    });

    it('should validate real generated UUIDs', () => {
      const uuid = generateUuid();
      expect(isValidUuid(uuid)).toBe(true);
    });
  });

  describe('createDeterministicUuidGenerator', () => {
    it('should create generator that produces deterministic UUIDs', () => {
      const generator = createDeterministicUuidGenerator(1);
      const uuid1 = generator();
      const uuid2 = generator();

      expect(uuid1).not.toBe(uuid2);

      // Reset and generate again
      const generator2 = createDeterministicUuidGenerator(1);
      const uuid3 = generator2();
      const uuid4 = generator2();

      expect(uuid1).toBe(uuid3);
      expect(uuid2).toBe(uuid4);
    });

    it('should increment seed for each call', () => {
      const generator = createDeterministicUuidGenerator(100);
      const uuid1 = generator();
      const uuid2 = generator();

      expect(uuid1).toBe(generateDeterministicUuid(100));
      expect(uuid2).toBe(generateDeterministicUuid(101));
    });
  });

  describe('createUuidGenerator', () => {
    it('should create generator that produces random UUIDs', () => {
      const generator = createUuidGenerator();
      const uuid1 = generator();
      const uuid2 = generator();

      expect(uuid1).not.toBe(uuid2);
      expect(isValidUuid(uuid1)).toBe(true);
      expect(isValidUuid(uuid2)).toBe(true);
    });
  });

  describe('RequestIdGenerator', () => {
    describe('deterministic mode', () => {
      it('should generate deterministic IDs', () => {
        const generator = new RequestIdGenerator(true, 1);
        const id1 = generator.next();
        const id2 = generator.next();

        const generator2 = new RequestIdGenerator(true, 1);
        const id3 = generator2.next();
        const id4 = generator2.next();

        expect(id1).toBe(id3);
        expect(id2).toBe(id4);
      });

      it('should generate batch of IDs', () => {
        const generator = new RequestIdGenerator(true, 1);
        const ids = generator.nextBatch(3);

        expect(ids).toHaveLength(3);
        expect(ids[0]).not.toBe(ids[1]);
        expect(ids[1]).not.toBe(ids[2]);
      });

      it('should reset to starting seed', () => {
        const generator = new RequestIdGenerator(true, 10);
        const id1 = generator.next();
        generator.next(); // Advance

        generator.reset(10);
        const id2 = generator.next();

        expect(id1).toBe(id2);
      });
    });

    describe('random mode', () => {
      it('should generate random UUIDs', () => {
        const generator = new RequestIdGenerator(false);
        const id1 = generator.next();
        const id2 = generator.next();

        expect(id1).not.toBe(id2);
        expect(isValidUuid(id1)).toBe(true);
        expect(isValidUuid(id2)).toBe(true);
      });

      it('should generate batch of random UUIDs', () => {
        const generator = new RequestIdGenerator(false);
        const ids = generator.nextBatch(3);

        expect(ids).toHaveLength(3);
        ids.forEach((id) => expect(isValidUuid(id)).toBe(true));

        const uniqueSet = new Set(ids);
        expect(uniqueSet.size).toBe(3);
      });
    });
  });

  describe('default generators', () => {
    it('should have deterministic default generator', () => {
      const id1 = defaultRequestIdGenerator.next();
      const id2 = defaultRequestIdGenerator.next();

      expect(id1).not.toBe(id2);
      // Should be deterministic format
      expect(id1).toMatch(/^[0-9a-f]{8}-0000-4000-8000-000000000000$/i);
    });

    it('should have real UUID generator', () => {
      const id1 = realUuidGenerator.next();
      const id2 = realUuidGenerator.next();

      expect(id1).not.toBe(id2);
      expect(isValidUuid(id1)).toBe(true);
      expect(isValidUuid(id2)).toBe(true);
    });
  });

  describe('UuidTestUtils', () => {
    describe('createMockUuid', () => {
      it('should create mock UUID with prefix', () => {
        const mockUuid = UuidTestUtils.createMockUuid('test');
        expect(mockUuid).toMatch(/^test0000-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i);
      });

      it('should create different mock UUIDs at different times', async () => {
        const uuid1 = UuidTestUtils.createMockUuid('test');
        // Small delay to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 1));
        const uuid2 = UuidTestUtils.createMockUuid('test');

        expect(uuid1).not.toBe(uuid2);
      });
    });

    describe('createMockUuidBatch', () => {
      it('should create batch of mock UUIDs', () => {
        const uuids = UuidTestUtils.createMockUuidBatch(3, 'batch');

        expect(uuids).toHaveLength(3);
        uuids.forEach((uuid) => {
          expect(uuid).toMatch(/^batch000-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
      });

      it('should create unique mock UUIDs in batch', () => {
        const uuids = UuidTestUtils.createMockUuidBatch(5, 'unique');
        const uniqueSet = new Set(uuids);
        expect(uniqueSet.size).toBe(5);
      });
    });

    describe('areAllUnique', () => {
      it('should return true for unique UUIDs', () => {
        const uuids = generateUuids(5);
        expect(UuidTestUtils.areAllUnique(uuids)).toBe(true);
      });

      it('should return false for duplicate UUIDs', () => {
        const uuid = generateUuid();
        const uuids = [uuid, generateUuid(), uuid];
        expect(UuidTestUtils.areAllUnique(uuids)).toBe(false);
      });
    });

    describe('areAllValid', () => {
      it('should return true for all valid UUIDs', () => {
        const uuids = generateUuids(3);
        expect(UuidTestUtils.areAllValid(uuids)).toBe(true);
      });

      it('should return false if any UUID is invalid', () => {
        const uuids = [generateUuid(), 'invalid-uuid', generateUuid()];
        expect(UuidTestUtils.areAllValid(uuids)).toBe(false);
      });
    });
  });
});
