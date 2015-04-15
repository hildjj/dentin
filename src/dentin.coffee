try
  require('source-map-support').install()
catch


fs = require 'fs'
assert = require 'assert'
xmljs = require 'libxmljs'
ww = require 'word-wrap'

DEFAULT_CONFIG = "./.dentin.json"

ESCAPES =
  '&': '&amp;'
  '<': '&lt;'
  '>': '&gt;'
  '"': '&quot;'
  "'": '&apos;'

QUOTE = "'"

SPACES = new Array(256).join ' '
spaces = (n) ->
  SPACES.substring(0, n)

escape = (str) ->
  str.replace /[&<>]/g, (m) ->
    ESCAPES[m]

escape_attr = (str) ->
  str.replace /[&<>"]/g, (m) ->
    ESCAPES[m]

attr_cmp = (a,b) ->
  ap = a.namespace()?.prefix()
  bp = b.namespace()?.prefix()
  res = 0
  if ap?
    if !bp?
      res = 1
    else
      res = ap.localeCompare bp, 'en'
  else if bp?
    res = -1
  if res == 0
    res = a.name().localeCompare b.name(), 'en'
  res

ns_cmp = (a,b) ->
  ap = a.prefix()
  bp = b.prefix()
  res = 0
  if ap?
    if !bp?
      res = 1
    else
      res = ap.localeCompare bp, 'en'
  res

capture = () ->
  f = (texts...) ->
    for t in texts
      f.result += t
  f.result = ""
  f

class Denter
  constructor: (opts) ->
    assert(opts?)
    @html = opts.html ? false
    @noversion = opts.noversion ? false
    @right_margin = opts.margin ? 70
    @indent_spaces = opts.spaces ? 2
    @ignore = opts.ignore ? []

  el_kind: (el) ->
    children = el.childNodes()
    ns = el.namespace()
    kind =
      text: false
      elements: false
      nonempty: false
      number: children.length
      name: if ns? and ns.prefix()?
        ns.prefix() + ":" + el.name()
      else
        el.name()

    for c in children
      switch c.type()
        when 'cdata' then kind.text = true
        when 'element' then kind.elements = true
        when 'text'
          kind.text = true
          if !c.text().match /^\s*$/
            kind.nonempty = true
        # ignore comments, entity_ref's for now

    kind.mixed = kind.elements and kind.nonempty
    kind

  print_element: (node, out, parent_kind, indent) ->
    kind = @el_kind(node)
    kind.mixed = kind.mixed or parent_kind?.mixed

    # If we're not outputting a version string, and this is the root, we don't
    # want a newline.
    if not @noversion or parent_kind?
      out "\n"
    out spaces @indent_spaces*indent

    # <foo
    out "<#{kind.name}"

    # < >boo="baz"
    attrs = node.attrs().sort(attr_cmp).map (a) ->
      ns = a.namespace()
      if ns?
        " #{ns.prefix()}:#{a.name()}=#{QUOTE}#{escape_attr(a.value())}#{QUOTE}"
      else
        " #{a.name()}=#{QUOTE}#{escape_attr(a.value())}#{QUOTE}"

    # < >xmlns:bar="urn:example:bar"
    decls = node.nsDecls().sort(ns_cmp).map (ns) ->
      p = ns.prefix()
      if p?
        " xmlns:#{p}=#{QUOTE}#{ns.href()}#{QUOTE}"
      else
        " xmlns=#{QUOTE}#{ns.href()}#{QUOTE}"
    attrs = attrs.concat decls

    # will all the attributes and namespace declarations fit?
    first = @indent_spaces*indent + kind.name.length + 1
    tot = attrs.reduce (p, a) ->
      p + a.length
    , first
    if (@right_margin > 0) and (tot > @right_margin)
      # no, they don't fit
      # each attribute on a new line, except first
      for a,i in attrs
        if i > 0
          out "\n"
          out spaces first
        out a
        kind.right_pos = first + attrs[attrs.length-1].length + 1
    else
      # yes, they fit
      kind.right_pos = first+1
      for a in attrs
        out a
        kind.right_pos += a.length

    # any children?  TODO: test for <foo><!-- --></foo>
    if kind.text or kind.elements
      # yes
      out ">"
      new_indent = indent+1

      if kind.mixed
        cap = capture()
        for c in node.childNodes()
          @print c, cap, kind, new_indent
        @print_text cap.result, out, kind, new_indent
      else
        for c in node.childNodes()
          @print c, out, kind, new_indent

      if kind.elements and not kind.nonempty
        out "\n#{spaces(@indent_spaces*indent)}"

      # </foo>
      out "</#{kind.name}>"
    else
      out "/>"

    if (parent_kind?.mixed and
        (node.nextSibling()?.type() == "text") and
        (!node.nextSibling().text().match(/^\./)))
      out " "

  print_text: (t, out, parent_kind, indent) ->
    ttl = t.trim().length
    # if we have element siblings, we're mixed
    # if there's non-whitespace, always output
    if !parent_kind.elements or ttl > 0
      # All whitespace not after a period gets collapsed to a single space
      t = t.replace /([^.])\s+/g, "$1 "
      # Newlines after a period get replaced with two spaces, except at the end.
      t = t.replace /[.]\n\s*(?!$)/g, ".  "
      t = t.trim()
      ttl = t.length

      # are we going to go over the edge <foo>^t</foo>
      len = ttl + parent_kind.right_pos + parent_kind.name.length + 3

      if (@right_margin > 0) and (len > @right_margin)
        out "\n"
        t = ww t.trim(),
          width: @right_margin - (@indent_spaces*indent)
          indent: spaces(@indent_spaces*indent)
        out t
        out "\n"
        out spaces @indent_spaces*(indent-1)
      else
        out t

  print: (node, out, parent_kind=null, indent=0) ->
    switch node.type()
      when 'element'
        @print_element node, out, parent_kind, indent
      when 'text'
        if parent_kind.name in @ignore
          out escape(node.text())
        else
          @print_text escape(node.text()), out, parent_kind, indent
      when 'cdata'
        out "<![CDATA[#{node.text()}]]>"
      when 'comment'
        out "<!-- #{node.text().trim()} -->"

  print_doc: (doc, out) ->
    if !@noversion
      if @html
        dtd = doc.getDtd()
        if dtd?
          out "<!DOCTYPE #{dtd.name}"
          if dtd.externalId?
            out " PUBLIC #{QUOTE}#{dtd.externalId}#{QUOTE}"
          if dtd.systemId?
            out " \"#{dtd.systemId}\""
          out ">"
      else
        out "<?xml version=#{QUOTE}#{doc.version()}#{QUOTE}?>"
    @print doc.root(), out
    out "\n"

@dent = dent = (xml, opts, out=process.stdout.write.bind(process.stdout)) ->
  if typeof(opts) == 'function'
    out = opts
    opts = {}
  if not opts?
    opts = {}

  if opts.doublequote
    QUOTE = '"'

  doc = switch
    when typeof(xml) == 'string', Buffer.isBuffer(xml)
      if opts?.html
        xmljs.parseHtml xml
      else
        xmljs.parseXml xml
    when xml instanceof xmljs.Document
      xml
    else
      throw new Error('invalid argument (xml)')
  new Denter(opts).print_doc doc, out

@dentToString = (xml, opts) ->
  out = ""
  collect = (all...) ->
    for a in all
      out += a
  dent xml, opts, collect
  out

@dentFile = (file_name, opts, cb) ->
  if file_name == '-'
    file_name = '/dev/stdin'
  fs.readFile file_name, (err, data) =>
    return cb(err) if err?
    cb null, @dent(data, opts)

collect = (val, memo) ->
  memo.push val
  memo

@read_config = (opts, cb) ->
  cfg = opts?.config ? DEFAULT_CONFIG
  if not cfg?
    return cb(null, opts)
  fs.exists cfg, (exists) ->
    if !exists then return cb(null, opts)
    fs.readFile cfg, (err, data) ->
      if err? then return cb(err)
      try
        config = JSON.parse data
        opts.ignore = opts.ignore.concat config.ignore
        opts.spaces = config.spaces or opts.spaces
        opts.margin = config.margin or opts.margin
        opts.html = !!config.html or opts.html
        opts.noversion = !!config.noversion or opts.noversion
        cb(null, opts)
      catch er
        cb(er)

pi = (n) ->
  parseInt n

@cmd = (args, cb) ->
  commander = require 'commander'
  pkg = require '../package'
  program = new commander.Command

  program
    .version pkg.version
    .option '-i, --ignore <name>',
      'Ignore elements with name for wrapping []', collect, []
    .option '-o, --output <file>', 'Output file name [stdout]'
    .option '-c, --config <file>', "Config file to read [#{DEFAULT_CONFIG}]",
      DEFAULT_CONFIG
    .option '-d, --doublequote', 'Use double quotes for attributes [false]',
      false
    .option '-m, --margin <int>', 'Right margin in spaces [78]', pi, 78
    .option '-s, --spaces <int>', 'Number of spaces to indent [2]', pi, 2
    .option '-n, --noversion', 'Don\'t output xml version prefix [false]'
    .option '--html',
      'Parse and generate HTML instead of XML [look at filename]'
    .usage '[options] [file...]'
    .parse args

  if program.args.length == 0
    program.args.push '-'

  if !program.html? and program.args[0].match(/.html?$/)
    program.html = true

  @read_config program, (er) =>
    if er?
      return process.stderr.write "#{program.config}: #{er.message}\n"

    for d in program.args
      @dentFile d, program, (er, output) ->
      if er?
        return cb(er)
      cb(null)
