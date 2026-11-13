module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          esModuleInterop: true,
          target: 'ES2022',
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.spec.tsx'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/test/style-mock.cjs',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 81,
      functions: 81,
      lines: 81,
      statements: 81,
    },
  },
  globals: {
    __API_BASE_URL__: '',
  },
};
