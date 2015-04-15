{dentToString} = require '../'

@pretty = (test) ->
  out = dentToString "<foo xmlns:foo='urn:foo' y='n'><foo:bar foo:x='y'/></foo>"
  test.deepEqual """<?xml version='1.0'?>
<foo y='n' xmlns:foo='urn:foo'>
  <foo:bar foo:x='y'/>
</foo>

""", out
  test.done()
