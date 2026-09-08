/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',  // ← теперь rootDir = bff/
  testRegex: 'src/.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/test/setup/integration-setup.ts',
  globalTeardown: '<rootDir>/src/test/setup/integration-teardown.ts',
  testTimeout: 60000,
  maxWorkers: 1,
};
