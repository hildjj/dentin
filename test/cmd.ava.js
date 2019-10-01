'use strict'

const path = require('path')
const test = require('ava')
const cmd = require('../lib/cmd')

test('config', async t => {
  let opts = await cmd._readConfig({
    config: path.join(__dirname, '..', '.dentin.json')
  })
  t.deepEqual(opts.ignore, ['artwork', 'sourcecode'])
  opts = await cmd._readConfig('fileThatDoesNotExit')
  t.deepEqual(opts, {})
})

test('cmd', async t => {
  const s = await cmd([
    process.execPath,
    __filename,
    path.join(__dirname, '..', 'examples', 'postal.xml'),
    '-o', '/dev/null',
    '-i', 'artwork',
    '-i', 'sourcecode',
    '-s', '4'
  ])
  t.is(s, undefined)
})
