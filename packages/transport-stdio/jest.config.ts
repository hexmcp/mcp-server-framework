import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@hexmcp/transport$': '<rootDir>/../transport/src',
    '^@hexmcp/transport/(.*)$': '<rootDir>/../transport/src/$1',
    '^@hexmcp/codec-jsonrpc$': '<rootDir>/../codec-jsonrpc/src',
    '^@hexmcp/codec-jsonrpc/(.*)$': '<rootDir>/../codec-jsonrpc/src/$1',
  },
};

export default config;
