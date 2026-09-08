/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',  // ← теперь rootDir = bff/
  testRegex: 'src/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test/setup/env.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};
