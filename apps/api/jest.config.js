/** @type {import('jest').Config} */
const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};

module.exports = {
  projects: [
    { ...shared, displayName: 'unit', rootDir: '.', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    { ...shared, displayName: 'e2e', rootDir: '.', testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'] },
  ],
};
