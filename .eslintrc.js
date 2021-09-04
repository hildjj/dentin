'use strict'

module.exports = {
  root: true,
  extends: ['@cto.af'],
  rules: {
    'no-unused-expressions': ['error', {allowTaggedTemplates: true}],
  },
}
