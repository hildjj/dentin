'use strict'

const fs = require('fs')
const xmljs = require('libxmljs')
const ww = require('word-wrap')
const chalk = require('chalk')
const {StringWriter} = require('./utils')

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&apos;',
  '\xA0': '&nbsp;'
}

const VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]

const BOOLEAN_ATTRIBUTES = [
  'allowfullscreen',
  'allowpaymentrequest',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
  'truespeed',
  'typemustmatch'
]

const SPACES = new Array(256).join(' ')

const DEFAULT_THEME = {
  PUNCTUATION: 'dim',
  ELEMENT: [0, 116, 232],
  ATTRIBUTE: 'magenta',
  ATTRIBUTE_VALUE: [221, 0, 169],
  TEXT: 'reset'
}

function escape(str) {
  return str.replace(/[&<>\xA0]/g, m => ESCAPES[m])
}

function escapeAttr(str) {
  return str.replace(/[&<>"'\xA0]/g, m => ESCAPES[m])
}

function nsCmp(a, b) {
  let res = 0
  if (a == null) {
    if (b != null) {
      res = -1
    }
  } else if (b == null) {
    res = 1
  } else {
    const ap = a.prefix()
    const bp = b.prefix()
    if (ap != null) {
      if ((bp == null)) {
        res = 1
      } else {
        res = ap.localeCompare(bp, 'en')
      }
    } else if (bp != null) {
      res = -1
    }
  }
  return res
}

function attrCmp(a, b) {
  const ans = a.namespace()
  const bns = b.namespace()
  let res = nsCmp(ans, bns)
  if (res === 0) {
    res = a.name().localeCompare(b.name(), 'en')
  }
  return res
}

/**
 * Indent XML or HTML.
 *
 * @class
 */
class Dentin {
  /**
   * Create an instance of a Dentin.
   *
   * @param {object} opts - configuration options
   * @param {Boolean|null} [colors=null] - colorize output.  If null, colorize
   *   if the terminal supports it.
   * @param {Boolean} [opts.doubleQuote=false] - use double quotes instead
   *   of single
   * @param {Boolean} [opts.fewerQuotes=false] - in HTML docs, only use quotes
   *   around attribute values that require them
   * @param {Boolean} [opts.html=false] - use HTML rules instead of XML rules.
   * @param {Array<String>} [opts.ignore=[]] - don't alter whitespace for the
   *   text inside these elements
   * @param {Number} [opts.margin=78] - line length for word wrapping
   * @param {Boolean} [opts.noVersion=false] - Don't output XML version header
   * @param {stream.Writable} [opts.output=null] - stream to write output to.
   *   If null, process.stdout is used.
   * @param {Number} [opts.spaces=2] - number of spaces to indent each level
   */
  constructor(opts = {}) {
    this.opts = Object.assign({
      colors: true,
      doubleQuote: false,
      fewerQuotes: false,
      html: false,
      ignore: [],
      margin: 78,
      noVersion: false,
      output: null,
      spaces: 2,
      theme: DEFAULT_THEME
    }, opts)

    this.first = true
    this.out = this.opts.output || process.stdout
    const level = ((this.opts.colors === false) ||
                   ((this.opts.colors == null) && !this.out.isTTY)) ?
      0 : chalk.level
    this.chalk = new chalk.Instance({level})
    for (const [typ, color] of Object.entries(this.opts.theme)) {
      this.chalk[typ] = this.chalk[color] ||
        (Array.isArray(color) ?
          this.chalk.rgb(...color) :
          this.chalk.hex(color))
    }
    this.quote = this.chalk.PUNCTUATION(this.opts.doubleQuote ? '"' : '\'')
  }

  /**
   * @private
   */
  _newline() {
    if (this.opts.spaces >= 0) {
      this.out.write('\n')
    }
  }

  /**
   * @private
   */
  _spaces(n) {
    let len = 0
    // n might be <= 0
    while (len < n) {
      const s = SPACES.substring(0, n)
      len += s.length
      this.out.write(s)
    }
    return len
  }

  _indent(stops) {
    return this._spaces(this.opts.spaces * stops)
  }

  /**
   * @private
   */
  _elKind(el) {
    const children = el.childNodes()
    const ns = el.namespace()
    const name = ((ns != null) && (ns.prefix() != null)) ?
      ns.prefix() + ':' + el.name() : el.name()

    const kind = {
      dtd: false,
      text: false,
      elements: false,
      mixed: false,
      nonempty: false,
      number: children.length,
      void: false,
      name
    }

    if (this.opts.html) {
      kind.name = kind.name.toLowerCase()
      kind.void = VOID_ELEMENTS.includes(kind.name)
      if (kind.void) {
        if (children.length > 0) {
          throw new Error(`Void element '${kind.name}' ` +
            `with children at line ${el.line()}`
          )
        }
      }
    }

    for (const c of children) {
      switch (c.type()) {
        case 'cdata':
          kind.text = true
          break
        case 'element':
          kind.elements = true
          break
        case 'text':
          kind.text = true
          const ntext = c.text().replace(/\xA0/g, '&nbsp;')
          if (!ntext.match(/^\s*$/)) {
            kind.nonempty = true
          }
          break
        case 'comment':
          kind.elements = true
          break
        case 'entity_ref':
          kind.nonempty = true
          break
        case 'pi':
          kind.elements = true
          break
        /* istanbul ignore next */
        default:
          throw new Error(`unknown node type: ${c.type()}`)
      }
    }

    kind.mixed = kind.elements && kind.nonempty
    return kind
  }

  /**
   * @private
   */
  _printPI(node, parentKind, indent) {
    const parentDTD = parentKind && parentKind.dtd
    if (!this.first && !parentDTD) {
      this._newline()
    }
    this.first = false
    this._indent(indent)

    // TODO: turn dquote into quote, even though it's technically wrong?
    this.out.write(this.chalk.PUNCTUATION('<?'))
    this.out.write(this.chalk.ELEMENT(node.name()))
    const txt = node.text()
    if (txt.length > 0) {
      this.out.write(' ')
      this.out.write(txt)
    }
    this.out.write(this.chalk.PUNCTUATION('?>'))
    if (parentDTD) {
      this._newline()
    }
  }

  /**
   * @private
   */
  _printDTD(node, parentKind, indent) {
    const children = node.childNodes()
    if (this.opts.html && this.opts.noVersion && (children.length === 0)) {
      return
    }

    if (!this.first) {
      this._newline()
    }
    this.first = false

    let total = this._indent(indent)
    const {name, externalId, systemId} = node.doc().getDtd()

    total += name.length + 12
    if (externalId) {
      total += externalId.length + systemId.length + 13
    } else if (systemId) {
      total += systemId.length + 10
    }

    const oneLine = total < this.opts.margin
    this.out.write(
      this.chalk`{PUNCTUATION <!}{ELEMENT DOCTYPE} {ATTRIBUTE ${name}}`)
    if (externalId) {
      this.out.write(this.chalk` {ATTRIBUTE PUBLIC}`) 
      if (oneLine) {
        this.out.write(' ')
      } else {
        this._newline()
        this._indent(indent + 1)
      }
      this.out.write(
        this.chalk`${this.quote}{ATTRIBUTE_VALUE ${externalId}}${this.quote}`)
      if (oneLine) {
        this.out.write(' ')
      } else {
        this._newline()
        this._indent(indent + 1)
      }
      this.out.write(
        this.chalk`${this.quote}{ATTRIBUTE_VALUE ${systemId}}${this.quote}`)
    } else if (systemId) {
      this.out.write(this.chalk` {ATTRIBUTE SYSTEM}`)
      if (oneLine) {
        this.out.write(' ')
      } else {
        this._newline()
        this._indent(indent + 1)
      }
      this.out.write(
        this.chalk`${this.quote}{ATTRIBUTE_VALUE ${systemId}}${this.quote}`)
    }

    if (children.length > 0) {
      const kind = {
        dtd: true,
        text: false,
        elements: true,
        mixed: false,
        nonempty: true,
        number: children.length,
        void: false,
        name: 'dtd'
      }

      this.out.write(this.chalk` {PUNCTUATION [}\n`)
      for (const c of children) {
        this._print(c, kind, indent+1)
      }
      this.out.write(this.chalk`{PUNCTUATION ]}`)
    }
    this.out.write(this.chalk`{PUNCTUATION >}`)
  }

  /**
   * @private
   */
  _printElement(node, parentKind, indent) {
    const kind = this._elKind(node)
    const parentMixed = parentKind && parentKind.mixed
    kind.mixed = kind.mixed || parentMixed

    // will all the attributes and namespace declarations fit?
    let first = -Infinity

    // If the parent is mixed, we don't want a newline or an indent.
    if (!parentMixed) {
      // If we're not outputting a version string, and this is the root,
      // and there's no PI or comment in front of us, we don't want a newline.
      if (!this.first) {
        this._newline()
      }
      first = this._indent(indent) + kind.name.length + 1
    }
    this.first = false
    let tot = first

    // <foo
    this.out.write(this.chalk`{PUNCTUATION <}{ELEMENT ${kind.name}}`)

    // < >boo="baz"
    let attrs = node.attrs().sort(attrCmp).map(a => {
      const ns = a.namespace()
      let aname = a.name()
      if (this.opts.html) {
        aname = aname.toLowerCase()
      }
      aname = (ns != null) ? `${ns.prefix()}:${aname}` : aname
      const val = escapeAttr(a.value())
      if (this.opts.html) {
        if (BOOLEAN_ATTRIBUTES.includes(aname) || !val) {
          tot += aname.length + 1
          return this.chalk` {ATTRIBUTE ${aname}}`
        }
        if (this.opts.fewerQuotes && !val.includes(' ')) {
          // must not contain any literal ASCII whitespace, any
          // U+0022 QUOTATION MARK characters ("), U+0027 APOSTROPHE
          // characters ('), U+003D EQUALS SIGN characters (=),
          // U+003C LESS-THAN SIGN characters (<),
          // U+003E GREATER-THAN SIGN characters (>),
          // or U+0060 GRAVE ACCENT characters (`),
          // and must not be the empty string
          if (val.match(/^[^ \t\r\n"'=<>`]+$/)) {
            tot += aname.length + val.length + 2
            return this.chalk` {ATTRIBUTE ${aname}}{PUNCTUATION =}{ATTRIBUTE_VALUE ${val}}`
          }
        }
      }
      tot += aname.length + val.length + 4
      return this.chalk` {ATTRIBUTE ${aname}}{PUNCTUATION =}${this.quote}{ATTRIBUTE_VALUE ${val}}${this.quote}`
    })

    // < >xmlns:bar="urn:example:bar"
    const decls = node.namespaces(true).sort(nsCmp).map((ns) => {
      const p = ns.prefix()
      const href = ns.href()
      if (p != null) {
        tot += p.length + href.length + 10
        return this.chalk` {ATTRIBUTE xmlns:${p}}{PUNCTUATION =}${this.quote}{ATTRIBUTE_VALUE ${href}}${this.quote}`
      } else {
        tot += href.length + 9
        return this.chalk` {ATTRIBUTE xmlns}{PUNCTUATION =}${this.quote}{ATTRIBUTE_VALUE ${ns.href()}}${this.quote}`
      }
    })
    attrs = attrs.concat(decls)

    if ((this.opts.margin > 0) && (tot > this.opts.margin)) {
      // no, they don't fit
      // each attribute on a new line, except first
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i]
        if ((i > 0) && (this.opts.spaces > 0)) {
          this._newline()
          this._spaces(first)
        }
        this.out.write(a)
        kind.right_pos = first + attrs[attrs.length-1].length + 1
      }
    } else {
      // yes, they fit
      kind.right_pos = first+1
      for (const a of attrs) {
        this.out.write(a)
        kind.right_pos += a.length
      }
    }

    // any children?
    if (kind.text || kind.elements) {
      // yes
      this.out.write(this.chalk.PUNCTUATION('>'))
      const new_indent = indent+1

      if (kind.mixed) {
        const rm = this.opts.margin
        this.opts.margin = Infinity
        for (const c of node.childNodes()) {
          this._print(c, kind, 0)
        }
        this.opts.margin = rm
      } else {
        for (const c of node.childNodes()) {
          this._print(c, kind, new_indent)
        }
      }

      if (kind.elements && !kind.nonempty && !parentMixed) {
        this._newline()
        this._indent(indent)
      }

      // </foo>
      this.out.write(this.chalk`{PUNCTUATION </}{ELEMENT ${kind.name}}{PUNCTUATION >}`)
    } else {
      if (kind.void) {
        this.out.write(this.chalk.PUNCTUATION('>'))
      } else {
        if (this.opts.html) {
          // in HTML, if it's not a void element, you MUST output the close tag
          this.out.write(this.chalk`{PUNCTUATION ></}{ELEMENT ${kind.name}}{PUNCTUATION >}`)
        } else {
          this.out.write(this.chalk.PUNCTUATION('/>'))
        }
      }
    }
  }

  /**
   * @private
   */
  _printText(node, parentKind, indent) {
    let t = node.text()
    if (!parentKind.comment) {
      t = escape(t)
    }
    let ttl = t.trim().length
    // if we have element siblings, we're mixed
    // if there's non-whitespace, always output
    if (!parentKind.elements || (ttl > 0)) {
      // All whitespace not after a period gets collapsed to a single space
      t = t.replace(/([^.])\s+/g, '$1 ')
      // Newlines after a period get replaced with two spaces,
      // except at the end.
      t = t.replace(/[.]\n\s*(?!$)/g, '.  ')

      // if the parent is mixed, only trim at the beginning and end.
      if (parentKind.mixed) {
        if ((node.prevSibling() == null)) {
          t = t.trimLeft()
        }
        if ((node.nextSibling() == null)) {
          t = t.trimRight()
        }
      } else {
        t = t.trim()
      }
      ttl = t.length

      // are we going to go over the edge <foo>^t</foo>
      const len = ttl + parentKind.right_pos + parentKind.name.length + 3

      if (len > this.opts.margin) {
        this._newline()
        if (this.opts.spaces < 0) {
          t = t.trim().replace(/\s*\n\s*/, ' ')
          if (parentKind.comment) {
            t = ' ' + t + ' '
          }
        } else {
          t = ww(t.trim(), {
            width: this.opts.margin - (this.opts.spaces*indent),
            indent: SPACES.substring(0, this.opts.spaces*indent),
            trim: true
          })
        }
        this.out.write(this.chalk.TEXT(t))
        this._newline()
        this._indent(indent-1)
      } else {
        if (parentKind.comment) {
          t = ` ${t} `
        }
        this.out.write(this.chalk.TEXT(t))
      }
    }
  }

  _printDecl(node, parentKind, indent) {
    this._indent(indent)
    let decl = node.toString()
    decl = decl.replace(/^<!+(\S+)\s+%\s+(\S+)/,
      this.chalk`{PUNCTUATION <!}{ELEMENT $1} {PUNCTUATION %} {ATTRIBUTE $2}`)
    decl = decl.replace(/^<!+(\S+)\s+(\S+)/,
      this.chalk`{PUNCTUATION <!}{ELEMENT $1} {ATTRIBUTE $2}`)
    decl = decl.replace(/"([^"]*)"/g,
      this.chalk`${this.quote}{ATTRIBUTE_VALUE $1}${this.quote}`)
    decl = decl.replace(/>\n/, this.chalk`{PUNCTUATION >}\n`)
    this.out.write(decl)
  }

  _printComment(node, parentKind, indent) {
    if (!this.first && (!parentKind || !(parentKind.dtd || parentKind.mixed))) {
      this._newline()
    }
    this.first = false
    if (!parentKind || !parentKind.mixed) {
      this._indent(indent)
    }
    this.out.write(this.chalk`{PUNCTUATION <!--}`)

    const kind = {
      dtd: false,
      text: true,
      elements: false,
      mixed: false,
      nonempty: true,
      number: 1,
      void: false,
      name: '!--',
      right_pos: indent * this.opts.spaces + 4,
      comment: true
    }
    this._printText(node, kind, indent+1)
    this.out.write(this.chalk`{PUNCTUATION -->}`)

    if (parentKind && parentKind.dtd) {
      // In DTD's, need to put newline at the end.
      this._newline()
    }
  }

  /**
   * @private
   */
  _print(node, parentKind=null, indent=0) {
    switch (node.type()) {
      case 'element':
        this._printElement(node, parentKind, indent)
        break
      case 'text':
        if (this.opts.ignore.includes(parentKind.name)) {
          this.out.write(escape(node.text()))
        } else {
          this._printText(node, parentKind, indent)
        }
        break
      case 'cdata':
        this.out.write(`<![CDATA[${node.text()}]]>`)
        break
      case 'comment':
        this._printComment(node, parentKind, indent)
        break
      case 'entity_ref':
        this.out.write(`&${node.name()};`)
        break
      case 'pi':
        this._printPI(node, parentKind, indent)
        break
      case 'dtd':
        this._printDTD(node, parentKind, indent)
        break
      case 'attribute_decl':
      case 'entity_decl':
      case 'element_decl':
        this._printDecl(node, parentKind, indent)
        break
      /* istanbul ignore next */
      default:
        throw new Error(`Unknown node print: ${node.type()}`)
    }
  }

  /**
   * Print a DOM document.
   *
   * @param {libxmljs.Document} doc - The document to print
   */
  printDoc(doc) {
    this.first = true
    if (!this.opts.noVersion) {
      if (!this.opts.html) {
        this.out.write(this.chalk`{PUNCTUATION <?}{ELEMENT xml} {ATTRIBUTE version}{PUNCTUATION =}${this.quote}{ATTRIBUTE_VALUE ${doc.version()}}${this.quote}?>`)
        this.first = false
      }
    }

    // libxmljs doesn't allow you to get all of the child nodes of the document,
    // just the root node.  Examples: comments, PI's, etc.
    // Surf to the front, then go back forward
    let node = doc.root()
    let firster = node
    while (firster) {
      node = firster
      firster = node.prevSibling()
    }
    while (node) {
      this._print(node)
      node = node.nextSibling()
    }
    this._newline()
  }

  /**
   * Indent some XML or HTML with the given options.
   *
   * @param {Buffer|String|libxmljs.Document} src - the source XML or HTML
   * @param {Object} opts - Options passed to Dentin constructor.
   */
  static dent(src, opts={}) {
    let doc = null
    if ((typeof src == 'string') || Buffer.isBuffer(src)) {
      if (opts.html) {
        doc = xmljs.parseHtml(src)
      } else {
        doc =xmljs.parseXml(src)
      }
    } else if (src instanceof xmljs.Document) {
      doc = src
    } else {
      throw new Error('invalid argument (xml)')
    }

    const d = new Dentin(opts)
    d.printDoc(doc)
  }

  /**
   * Return a string version of the indented document.
   *
   * @param {Buffer|String|libxmljs.Document} src - the source XML or HTML
   * @param {Object} opts - Options passed to Dentin constructor.
   */
  static dentToString(xml, opts = {}) {
    opts.output = new StringWriter()
    this.dent(xml, opts)
    return opts.output.read()
  }

  /**
   * Indent a file.  If the `html` option is not explicitly set, figure it
   * out from the file name.
   *
   * @param {String} fileName - the file to read
   * @param {Object} opts - Options passed to Dentin constructor.
   */
  static dentFile(fileName, opts) {
    return new Promise((resolve, reject) => {
      const str = (fileName === '-') ?
        process.stdin : fs.createReadStream(fileName)
      const bufs = []
      str.on('data', b => bufs.push(b))
      str.on('error', reject)
      str.on('end', () => {
        try {
          if ((opts.html == null) && fileName.match(/.html?$/)) {
            opts.html = true
          }
          this.dent(Buffer.concat(bufs), opts)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  }
}

module.exports = Dentin
