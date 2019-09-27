'use strict'

const test = require('ava')
const Dentin = require('../lib/dentin2')

test('dentToString', t => {
  const out = Dentin.dentToString(
    '<foo xmlns:foo=\'urn:foo\' y=\'n&apos;\'><foo:bar foo:x=\'y\'/></foo>')
  t.deepEqual(out, `<?xml version='1.0'?>
<foo y='n&apos;' xmlns:foo='urn:foo'>
  <foo:bar foo:x='y'/>
</foo>\n`)
})
