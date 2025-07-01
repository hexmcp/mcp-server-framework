import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { FIXTURE_ENCODING, FIXTURE_FILE_EXTENSIONS } from '../types/fixture-constants.js';
import { validateFixture } from '../types/fixture-schemas.js';
import type { FixtureCategory, FixtureDefinition } from '../types/fixture-types.js';

export interface FixtureLoadResult {
  fixtures: FixtureDefinition[];
  errors: FixtureLoadError[];
  summary: FixtureLoadSummary;
}

export interface FixtureLoadError {
  filePath: string;
  error: Error;
  type: 'read' | 'parse' | 'validate' | 'duplicate';
}

export interface FixtureLoadSummary {
  totalFiles: number;
  loadedFixtures: number;
  errors: number;
  categories: Record<FixtureCategory, number>;
  duplicateNames: string[];
}

export class FixtureLoader {
  private loadedFixtures = new Map<string, FixtureDefinition>();
  private errors: FixtureLoadError[] = [];

  constructor(private fixturesPath: string) {}

  async loadFixtures(): Promise<FixtureDefinition[]> {
    const result = await this.loadFixturesWithDetails();
    return result.fixtures;
  }

  async loadFixturesWithDetails(): Promise<FixtureLoadResult> {
    this.loadedFixtures.clear();
    this.errors = [];

    const files = await this.scanDirectory(this.fixturesPath);
    const fixtureFiles = files.filter((file) => this.isFixtureFile(file));

    for (const filePath of fixtureFiles) {
      await this.loadFixtureFile(filePath);
    }

    const fixtures = Array.from(this.loadedFixtures.values());
    const summary = this.generateSummary(fixtureFiles.length, fixtures);

    return {
      fixtures,
      errors: [...this.errors],
      summary,
    };
  }

  async loadFixturesByCategory(category: FixtureCategory): Promise<FixtureDefinition[]> {
    const allFixtures = await this.loadFixtures();
    return allFixtures.filter((fixture) => fixture.category === category);
  }

  async loadFixturesByTag(tag: string): Promise<FixtureDefinition[]> {
    const allFixtures = await this.loadFixtures();
    return allFixtures.filter((fixture) => fixture.tags?.includes(tag) || fixture.metadata?.tags?.includes(tag));
  }

  async loadFixtureByName(name: string): Promise<FixtureDefinition | undefined> {
    const allFixtures = await this.loadFixtures();
    return allFixtures.find((fixture) => fixture.name === name);
  }

  getLoadErrors(): FixtureLoadError[] {
    return [...this.errors];
  }

  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (stats.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.errors.push({
        filePath: dirPath,
        error: error instanceof Error ? error : new Error(String(error)),
        type: 'read',
      });
    }

    return files;
  }

  private isFixtureFile(filePath: string): boolean {
    const ext = extname(filePath);
    return FIXTURE_FILE_EXTENSIONS.includes(ext as (typeof FIXTURE_FILE_EXTENSIONS)[number]);
  }

  private async loadFixtureFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, FIXTURE_ENCODING);
      const rawFixture = JSON.parse(content);
      const fixture = validateFixture(rawFixture);

      if (this.loadedFixtures.has(fixture.name)) {
        this.errors.push({
          filePath,
          error: new Error(`Duplicate fixture name: ${fixture.name}`),
          type: 'duplicate',
        });
        return;
      }

      this.loadedFixtures.set(fixture.name, fixture);
    } catch (error) {
      const errorType = error instanceof SyntaxError ? 'parse' : 'validate';
      this.errors.push({
        filePath,
        error: error instanceof Error ? error : new Error(String(error)),
        type: errorType,
      });
    }
  }

  private generateSummary(totalFiles: number, fixtures: FixtureDefinition[]): FixtureLoadSummary {
    const categories: Record<FixtureCategory, number> = {
      basic: 0,
      auth: 0,
      lifecycle: 0,
      streaming: 0,
      registries: 0,
      errors: 0,
      performance: 0,
    };

    const duplicateNames: string[] = [];

    for (const fixture of fixtures) {
      categories[fixture.category]++;
    }

    for (const error of this.errors) {
      if (error.type === 'duplicate') {
        const match = error.error.message.match(/Duplicate fixture name: (.+)/);
        if (match?.[1]) {
          duplicateNames.push(match[1]);
        }
      }
    }

    return {
      totalFiles,
      loadedFixtures: fixtures.length,
      errors: this.errors.length,
      categories,
      duplicateNames,
    };
  }
}
