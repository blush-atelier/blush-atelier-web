const js = require('@eslint/js');
const ts = require('typescript-eslint');
module.exports = ts.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['test/**/*.cjs'],
    languageOptions: { globals: { module: 'readonly' } },
  },
  ...ts.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: { globals: { __API_BASE_URL__: 'readonly' } },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-*',
            '@reduxjs/*',
            '**/infrastructure/**',
            '**/presentation/**',
          ],
        },
      ],
    },
  },
);
