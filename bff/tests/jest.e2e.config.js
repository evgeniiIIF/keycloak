const shared = require('./jest.shared');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...shared,
  rootDir: '..',
  testRegex: 'tests/e2e/.*\\.e2e\\.spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/tests/shared/setup/silence-logger.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};
