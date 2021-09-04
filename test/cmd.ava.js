'use strict'

const path = require('path')
const test = require('ava')
const cmd = require('../lib/cmd')

test('cmd', async t => {
  const s = await cmd([
    path.join(__dirname, '..', 'examples', 'postal.xml'),
    '-o',
    '/dev/null',
    '-i',
    'artwork',
    '-i',
    'sourcecode',
    '-s',
    '4',
  ])
  t.is(s, undefined)
})
