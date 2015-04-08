{dentToString} = require '../'

@pretty = (test) ->
  out = dentToString "<foo><bar/></foo>"
  test.deepEqual '<?xml version="1.0"?>\n<foo>\n  <bar/>\n</foo>\n', out
  test.done()
