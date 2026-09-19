const shared = require('./jest.shared');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...shared,
  rootDir: '..',
  testRegex: 'tests/unit/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  setupFiles: ['<rootDir>/tests/shared/setup/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/shared/setup/silence-logger.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};
