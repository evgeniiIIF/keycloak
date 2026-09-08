/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@configs/(.*)$': '<rootDir>/src/configs/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  testRegex: 'test/integration/.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/shared/setup/integration-setup.ts',
  globalTeardown: '<rootDir>/test/shared/setup/integration-teardown.ts',
  testTimeout: 60000,
  maxWorkers: 1,
};
