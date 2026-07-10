/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'services/**/*.ts',
    'middleware/**/*.ts',
    '!**/*.dto.ts',
    '!**/*.module.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test-setup.ts'],
};
