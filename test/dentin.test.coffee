{dent} = require '../'

out = ""
rec = (others...) ->
  for o in others
    out += o

@pretty = (test) ->
  out = ""
  dent "<foo><bar/></foo>", rec
  test.deepEqual '<?xml version="1.0"?>\n<foo>\n  <bar/>\n</foo>\n', out
  test.done()
