import base from '@cto.af/eslint-config';
import markdown from '@cto.af/eslint-config/markdown.js';

export default [
  {
    ignores: [
    ],
  },
  ...base,
  ...markdown,
  {
    files: ['bin/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
