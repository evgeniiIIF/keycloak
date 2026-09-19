const shared = require('./jest.shared');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...shared,
  rootDir: '..',
  testRegex: 'tests/integration/.*\\.integration\\.spec\\.ts$',
  globalSetup: '<rootDir>/tests/shared/setup/integration-setup.ts',
  globalTeardown: '<rootDir>/tests/shared/setup/integration-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/shared/setup/silence-logger.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};
