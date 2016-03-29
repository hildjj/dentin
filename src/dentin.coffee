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
  "\xA0": '&nbsp;'

QUOTE = "'"

SPACES = new Array(256).join ' '
spaces = (n) ->
  SPACES.substring(0, n)

escape = (str) ->
  str.replace /[&<>\xA0]/g, (m) ->
    ESCAPES[m]

escape_attr = (str) ->
  str.replace /[&<>"'\xA0]/g, (m) ->
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
    @file = null

    if typeof(opts.output) == "function"
      @out = opts.output
    else if typeof(opts.output) == "string"
      @file = fs.openSync opts.output, 'w'
      @out = fs.writeSync.bind fs, @file
    else
      @out = process.stdout.write.bind process.stdout

  _el_kind: (el) ->
    children = el.childNodes()
    ns = el.namespace()
    kind =
      text: false
      elements: false
      mixed: false
      nonempty: false
      number: children.length
      void: false
      name: if ns? and ns.prefix()?
        ns.prefix() + ":" + el.name()
      else
        el.name()

    if @html
      kind.void = kind.name in [
        'area'
        'base'
        'br'
        'col'
        'command'
        'embed'
        'hr'
        'img'
        'input'
        'keygen'
        'link'
        'meta'
        'param'
        'source'
        'track'
        'wbr'
      ]
      if kind.void
        if (children.length > 0)
          console.error "Void element '#{kind.name}' " +
            "with children at line #{el.line()}"

    for c in children
      switch c.type()
        when 'cdata' then kind.text = true
        when 'element' then kind.elements = true
        when 'text'
          kind.text = true
          ntext = c.text().replace /\xA0/g, "&nbsp;"
          if !ntext.match /^\s*$/
            kind.nonempty = true
        when 'comment'
          kind.elements = true
        when 'entity_ref'
          kind.nonempty = true
        else
          console.error "unknown node type: #{c.type()}"

    kind.mixed = kind.elements and kind.nonempty
    kind

  _print_pi: (node, out, indent) ->
    if not @noversion or parent_kind? or node.prevSibling()?
      out "\n"
    out spaces @indent_spaces*indent

    # TODO: turn dquote into quote, even though it's technically wrong?
    out "<?#{node.name()} #{node.text()}?>"

  _print_dtd: (node, out, indent) ->
    t = node.toString()
    if t
      if not @noversion or parent_kind? or node.prevSibling()?
        out "\n"
      out spaces @indent_spaces*indent

      # TODO: don't punt.
      out t

  _print_element: (node, out, parent_kind, indent) ->
    kind = @_el_kind(node)
    kind.mixed = kind.mixed or parent_kind?.mixed

    # If this the parent is mixed, we don't want a newline or an indent.
    if not parent_kind?.mixed
      # If we're not outputting a version string, and this is the root, we don't
      # want a newline.
      if not @noversion or parent_kind?
        out "\n"
      out spaces @indent_spaces*indent

    # <foo
    out "<#{kind.name}"

    # < >boo="baz"
    attrs = node.attrs().sort(attr_cmp).map (a) =>
      ns = a.namespace()
      name = if ns?
        " #{ns.prefix()}:#{a.name()}"
      else
        " #{a.name()}"
      val = a.value()
      if @html and not val
        name
      else
        "#{name}=#{QUOTE}#{escape_attr(a.value())}#{QUOTE}"

    # < >xmlns:bar="urn:example:bar"
    decls = node.namespaces(true).sort(ns_cmp).map (ns) ->
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

    # any children?
    if kind.text or kind.elements
      # yes
      out ">"
      new_indent = indent+1

      if kind.mixed
        rm = @right_margin
        @right_margin = -1
        for c in node.childNodes()
          @_print c, out, kind, 0
        @right_margin = rm
      else
        for c in node.childNodes()
          @_print c, out, kind, new_indent

      if kind.elements and not kind.nonempty  and not parent_kind?.mixed
        out "\n#{spaces(@indent_spaces*indent)}"

      # </foo>
      out "</#{kind.name}>"
    else
      if kind.void
        out ">"
      else
        if @html
          # in HTML, if it's not a void element, you MUST output the close tag
          out "></#{kind.name}>"
        else
          out "/>"

  _print_text: (node, out, parent_kind, indent) ->
    t = escape(node.text())
    ttl = t.trim().length
    # if we have element siblings, we're mixed
    # if there's non-whitespace, always output
    if !parent_kind.elements or ttl > 0
      # All whitespace not after a period gets collapsed to a single space
      t = t.replace /([^.])\s+/g, "$1 "
      # Newlines after a period get replaced with two spaces, except at the end.
      t = t.replace /[.]\n\s*(?!$)/g, ".  "

      # if the parent is mixed, only trim at the beginning and end.
      if parent_kind.mixed
        if not node.prevSibling()?
          t = t.trimLeft()
        if not node.nextSibling()?
          t = t.trimRight()
      else
        t = t.trim()
      ttl = t.length

      # are we going to go over the edge <foo>^t</foo>
      len = ttl + parent_kind.right_pos + parent_kind.name.length + 3

      if (@right_margin > 0) and (len > @right_margin)
        out "\n"
        t = ww t.trim(),
          width: @right_margin - (@indent_spaces*indent)
          indent: spaces(@indent_spaces*indent)
          trim: true
        out t
        out "\n"
        out spaces @indent_spaces*(indent-1)
      else
        out t

  _print: (node, out, parent_kind=null, indent=0) ->
    switch node.type()
      when 'element'
        @_print_element node, out, parent_kind, indent
      when 'text'
        if (parent_kind.name in @ignore)
          out escape(node.text())
        else
          @_print_text node, out, parent_kind, indent
      when 'cdata'
        out "<![CDATA[#{node.text()}]]>"
      when 'comment'
        if not @noversion or parent_kind? or node.prevSibling()?
          out "\n"
        out spaces @indent_spaces*indent
        out "<!-- #{node.text().trim()} -->"
      when 'entity_ref'
        out "&#{node.name()};"
      when 'pi'
        @_print_pi node, out, indent
      when 'dtd'
        @_print_dtd node, out, indent
      else
        console.error "Unknown node print: #{node.type()}"

  print_doc: (doc) ->
    if !@noversion
      if @html
        dtd = doc.getDtd()
        if dtd?
          @out "<!DOCTYPE #{dtd.name}"
          if dtd.externalId?
            @out " PUBLIC #{QUOTE}#{dtd.externalId}#{QUOTE}"
          if dtd.systemId?
            @out " #{QUOTE}#{dtd.systemId}#{QUOTE}"
          @out ">"
      else
        @out "<?xml version=#{QUOTE}#{doc.version()}#{QUOTE}?>"

    # libxmljs doesn't allow you to get all of the child nodes of the document,
    # just the root node.  Examples: comments, PI's, etc.
    # Surf to the front, then go back forward
    node = doc.root()
    firster = node
    while firster
      node = firster
      firster = node.prevSibling()
    while node
      @_print node, @out
      node = node.nextSibling()
    @out "\n"

    if @file?
      fs.close @file

@dent = dent = (xml, opts) ->
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
  new Denter(opts).print_doc doc

@dentToString = (xml, opts={}) ->
  out = ""
  collect = (all...) ->
    for a in all
      out += a
  opts.output = collect
  dent xml, opts
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
