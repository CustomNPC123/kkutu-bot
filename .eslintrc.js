module.exports = {
  parserOptions: {
    ecmaVersion: 11,
  },
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:prettier/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  parser: '@typescript-eslint/parser',
};
