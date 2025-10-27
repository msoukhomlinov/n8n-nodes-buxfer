module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended'],
  plugins: ['@typescript-eslint'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};
