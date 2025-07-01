import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createErrorFixture, createSuccessFixture, FixtureCategory } from '../src/index.js';
import { FixtureLoader } from '../src/loader/fixture-loader.js';

describe('FixtureLoader', () => {
  const testFixturesDir = join(__dirname, 'test-fixtures');
  let loader: FixtureLoader;

  beforeEach(async () => {
    await rm(testFixturesDir, { recursive: true, force: true });
    await mkdir(testFixturesDir, { recursive: true });
    loader = new FixtureLoader(testFixturesDir);
  });

  afterEach(async () => {
    await rm(testFixturesDir, { recursive: true, force: true });
  });

  describe('loadFixtures', () => {
    it('should load valid fixtures from directory', async () => {
      const fixture1 = createSuccessFixture('test-ping', 'Test ping request', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      const fixture2 = createErrorFixture(
        'test-error',
        'Test error response',
        FixtureCategory.ERRORS,
        'invalid/method',
        {},
        -32601,
        'Method not found'
      );

      await writeFile(join(testFixturesDir, 'ping.json'), JSON.stringify(fixture1, null, 2));
      await writeFile(join(testFixturesDir, 'error.json'), JSON.stringify(fixture2, null, 2));

      const fixtures = await loader.loadFixtures();

      expect(fixtures).toHaveLength(2);
      expect(fixtures.map((f) => f.name)).toContain('test-ping');
      expect(fixtures.map((f) => f.name)).toContain('test-error');
    });

    it('should recursively scan subdirectories', async () => {
      const basicDir = join(testFixturesDir, 'basic');
      const errorsDir = join(testFixturesDir, 'errors');

      await mkdir(basicDir, { recursive: true });
      await mkdir(errorsDir, { recursive: true });

      const fixture1 = createSuccessFixture('basic-ping', 'Basic ping', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      const fixture2 = createErrorFixture('error-test', 'Error test', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Not found');

      await writeFile(join(basicDir, 'ping.json'), JSON.stringify(fixture1, null, 2));
      await writeFile(join(errorsDir, 'error.json'), JSON.stringify(fixture2, null, 2));

      const fixtures = await loader.loadFixtures();

      expect(fixtures).toHaveLength(2);
      expect(fixtures.find((f) => f.name === 'basic-ping')).toBeDefined();
      expect(fixtures.find((f) => f.name === 'error-test')).toBeDefined();
    });

    it('should handle malformed JSON files', async () => {
      await writeFile(join(testFixturesDir, 'invalid.json'), '{ invalid json }');

      const result = await loader.loadFixturesWithDetails();

      expect(result.fixtures).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe('parse');
    });

    it('should handle invalid fixture schema', async () => {
      const invalidFixture = {
        name: 'invalid',
        // Missing required fields
      };

      await writeFile(join(testFixturesDir, 'invalid.json'), JSON.stringify(invalidFixture, null, 2));

      const result = await loader.loadFixturesWithDetails();

      expect(result.fixtures).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe('validate');
    });

    it('should detect duplicate fixture names', async () => {
      const fixture1 = createSuccessFixture('duplicate-name', 'First fixture', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      const fixture2 = createSuccessFixture('duplicate-name', 'Second fixture', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      await writeFile(join(testFixturesDir, 'first.json'), JSON.stringify(fixture1, null, 2));
      await writeFile(join(testFixturesDir, 'second.json'), JSON.stringify(fixture2, null, 2));

      const result = await loader.loadFixturesWithDetails();

      expect(result.fixtures).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe('duplicate');
      expect(result.summary.duplicateNames).toContain('duplicate-name');
    });

    it('should ignore non-JSON files', async () => {
      const fixture = createSuccessFixture('test-ping', 'Test ping', FixtureCategory.BASIC, 'ping', {}, { pong: true });

      await writeFile(join(testFixturesDir, 'fixture.json'), JSON.stringify(fixture, null, 2));
      await writeFile(join(testFixturesDir, 'readme.txt'), 'This is not a fixture');
      await writeFile(join(testFixturesDir, 'config.yaml'), 'key: value');

      const fixtures = await loader.loadFixtures();

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0]?.name).toBe('test-ping');
    });
  });

  describe('loadFixturesByCategory', () => {
    beforeEach(async () => {
      const basicFixture = createSuccessFixture('basic-test', 'Basic test', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      const errorFixture = createErrorFixture('error-test', 'Error test', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Not found');

      await writeFile(join(testFixturesDir, 'basic.json'), JSON.stringify(basicFixture, null, 2));
      await writeFile(join(testFixturesDir, 'error.json'), JSON.stringify(errorFixture, null, 2));
    });

    it('should filter fixtures by category', async () => {
      const basicFixtures = await loader.loadFixturesByCategory(FixtureCategory.BASIC);
      const errorFixtures = await loader.loadFixturesByCategory(FixtureCategory.ERRORS);

      expect(basicFixtures).toHaveLength(1);
      expect(basicFixtures[0]?.name).toBe('basic-test');

      expect(errorFixtures).toHaveLength(1);
      expect(errorFixtures[0]?.name).toBe('error-test');
    });

    it('should return empty array for non-existent category', async () => {
      const fixtures = await loader.loadFixturesByCategory(FixtureCategory.STREAMING);
      expect(fixtures).toHaveLength(0);
    });
  });

  describe('loadFixturesByTag', () => {
    beforeEach(async () => {
      const fixture1 = createSuccessFixture('test-1', 'Test 1', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      fixture1.tags = ['connectivity', 'basic'];

      const fixture2 = createSuccessFixture('test-2', 'Test 2', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      fixture2.metadata = { tags: ['connectivity', 'advanced'] };

      await writeFile(join(testFixturesDir, 'test1.json'), JSON.stringify(fixture1, null, 2));
      await writeFile(join(testFixturesDir, 'test2.json'), JSON.stringify(fixture2, null, 2));
    });

    it('should filter fixtures by tag', async () => {
      const connectivityFixtures = await loader.loadFixturesByTag('connectivity');
      const basicFixtures = await loader.loadFixturesByTag('basic');

      expect(connectivityFixtures).toHaveLength(2);
      expect(basicFixtures).toHaveLength(1);
      expect(basicFixtures[0]?.name).toBe('test-1');
    });
  });

  describe('loadFixtureByName', () => {
    beforeEach(async () => {
      const fixture = createSuccessFixture('unique-name', 'Unique test', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      await writeFile(join(testFixturesDir, 'unique.json'), JSON.stringify(fixture, null, 2));
    });

    it('should find fixture by name', async () => {
      const fixture = await loader.loadFixtureByName('unique-name');
      expect(fixture).toBeDefined();
      expect(fixture?.name).toBe('unique-name');
    });

    it('should return undefined for non-existent name', async () => {
      const fixture = await loader.loadFixtureByName('non-existent');
      expect(fixture).toBeUndefined();
    });
  });

  describe('loadFixturesWithDetails', () => {
    it('should provide detailed loading results', async () => {
      const basicFixture = createSuccessFixture('basic-test', 'Basic test', FixtureCategory.BASIC, 'ping', {}, { pong: true });
      const errorFixture = createErrorFixture('error-test', 'Error test', FixtureCategory.ERRORS, 'invalid', {}, -32601, 'Not found');

      await writeFile(join(testFixturesDir, 'basic.json'), JSON.stringify(basicFixture, null, 2));
      await writeFile(join(testFixturesDir, 'error.json'), JSON.stringify(errorFixture, null, 2));
      await writeFile(join(testFixturesDir, 'invalid.json'), '{ invalid }');

      const result = await loader.loadFixturesWithDetails();

      expect(result.fixtures).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.summary.totalFiles).toBe(3);
      expect(result.summary.loadedFixtures).toBe(2);
      expect(result.summary.errors).toBe(1);
      expect(result.summary.categories.basic).toBe(1);
      expect(result.summary.categories.errors).toBe(1);
    });
  });
});
