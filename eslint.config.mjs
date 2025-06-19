import base from '@cto.af/eslint-config';
import markdown from '@cto.af/eslint-config/markdown.js';
import mod from '@cto.af/eslint-config/module.js';

export default [
  {
    ignores: [
    ],
  },
  ...base,
  ...mod,
  ...markdown,
  {
    files: ['bin/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
