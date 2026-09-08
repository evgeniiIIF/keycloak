/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'services/**/*.ts',
    'middleware/**/*.ts',
    'guards/**/*.ts',
    'interceptors/**/*.ts',
    'filters/**/*.ts',
    'shared/**/*.ts',
    'config/**/*.ts',
    '!**/*.dto.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
};
