import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@hexmcp/codec-jsonrpc$': '<rootDir>/packages/codec-jsonrpc/src/index.ts',
    '^@hexmcp/transport$': '<rootDir>/packages/transport/src/index.ts',
    '^@hexmcp/core$': '<rootDir>/packages/core/src/index.ts',
  },
  collectCoverageFrom: ['packages/**/*.{ts,tsx}', '!packages/**/*.d.ts', '!packages/**/node_modules/**'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  passWithNoTests: true,
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/**/*.(test|spec).+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@hexmcp/codec-jsonrpc$': '<rootDir>/packages/codec-jsonrpc/src/index.ts',
        '^@hexmcp/transport$': '<rootDir>/packages/transport/src/index.ts',
        '^@hexmcp/core$': '<rootDir>/packages/core/src/index.ts',
      },
    },
    {
      displayName: 'transport',
      testMatch: ['<rootDir>/packages/transport/**/*.(test|spec).+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@hexmcp/codec-jsonrpc$': '<rootDir>/packages/codec-jsonrpc/src/index.ts',
        '^@hexmcp/transport$': '<rootDir>/packages/transport/src/index.ts',
        '^@hexmcp/core$': '<rootDir>/packages/core/src/index.ts',
      },
    },
    {
      displayName: 'codec-jsonrpc',
      testMatch: ['<rootDir>/packages/codec-jsonrpc/**/*.(test|spec).+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@hexmcp/codec-jsonrpc$': '<rootDir>/packages/codec-jsonrpc/src/index.ts',
        '^@hexmcp/transport$': '<rootDir>/packages/transport/src/index.ts',
        '^@hexmcp/core$': '<rootDir>/packages/core/src/index.ts',
      },
    },
  ],
};

export default config;
