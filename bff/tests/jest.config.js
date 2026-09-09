/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@configs/(.*)$': '<rootDir>/src/configs/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  testRegex: 'tests/unit/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/shared/setup/env.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};
