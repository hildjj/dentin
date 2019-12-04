'use strict'

const test = require('ava')
const chalk = require('chalk')
const utils = require('../lib/utils')

test('setChalkTheme', t => {
  const c = new chalk.Instance({level: 3})
  utils.setChalkTheme(c, {
    TESTME: '0xbeefee'
  })
  t.is(typeof c.TESTME, 'function')
  const s = c`{TESTME foo}`
  t.is(typeof s, 'string')
  t.not(s, 'foo')
  t.not(s, '{TESTME foo}')
  const s2 = c.TESTME('foo')
  t.is(s, s2)
})

test('extract', t => {
  t.is(utils.extract(null, ['foo', 'bar']), null)
  t.is(utils.extract(null, null), null)
  t.deepEqual(utils.extract({a: 1}, null), {})
  t.deepEqual(utils.extract({foo: 1, baz: 2}, ['foo', 'bar']), {foo: 1})
})
