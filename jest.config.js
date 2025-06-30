module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
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
    },
    {
      displayName: 'transport',
      testMatch: ['<rootDir>/packages/transport/**/*.(test|spec).+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'codec-jsonrpc',
      testMatch: ['<rootDir>/packages/codec-jsonrpc/**/*.(test|spec).+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
  ],
};
