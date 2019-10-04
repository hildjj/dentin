'use strict'

const fs = require('fs')
const stream = require('stream')
const xmljs = require('libxmljs')
const ww = require('word-wrap')

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
   * @param {Boolean} [html=false] - use HTML rules instead of XML rules.
   * @param {Boolean} [noVersion=false] - Don't output XML version header
   * @param {Number} [margin=70] - word wrap when we get to this column
   * @param {Number} [spaces=2] - number of spaces to indent each level
   * @param {Boolean} [doubleQuote=false] - use double quotes instead of single
   * @param {Array<String>} [ignore=[]] - don't alter whitespace for the text
   *   inside these elements
   * @param {stream.Writable} [output=null] - stream to write output to.
   *   If null, process.stdout is used.
   */
  constructor(opts = {}) {
    this.opts = Object.assign({
      html: false,
      fewerQuotes: false,
      noVersion: false,
      margin: 70,
      spaces: 2,
      doubleQuote: false,
      ignore: [],
      output: null
    }, opts)

    this.quote = this.opts.doubleQuote ? '"' : '\''
    this.out = this.opts.output || process.stdout
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
    if (!this.opts.noVersion ||
        (typeof parentKind !== 'undefined' && parentKind !== null) ||
        (node.prevSibling() != null)) {
      this._newline()
    }
    this._indent(indent)

    // TODO: turn dquote into quote, even though it's technically wrong?
    return this.out.write(`<?${node.name()} ${node.text()}?>`)
  }

  /**
   * @private
   */
  _printDTD(node, parentKind, indent) {
    const t = node.toString()
    if (t) {
      if (!this.opts.noVersion ||
          (typeof parentKind !== 'undefined' && parentKind !== null) ||
          (node.prevSibling() != null)) {
        this._newline()
      }
      this._indent(indent)

      // TODO: don't punt.
      return this.out.write(t)
    }
  }

  /**
   * @private
   */
  _printElement(node, parentKind, indent) {
    const kind = this._elKind(node)
    kind.mixed = kind.mixed ||
      (parentKind != null ? parentKind.mixed : undefined)

    // If this the parent is mixed, we don't want a newline or an indent.
    if (!(parentKind != null ? parentKind.mixed : undefined)) {
      // If we're not outputting a version string, and this is the root,
      // we don't want a newline.
      if (!this.opts.noVersion || (parentKind != null)) {
        this._newline()
      }
      this._indent(indent)
    }

    // <foo
    this.out.write(`<${kind.name}`)

    // < >boo="baz"
    let attrs = node.attrs().sort(attrCmp).map(a => {
      const ns = a.namespace()
      let aname = a.name()
      if (this.opts.html) {
        aname = aname.toLowerCase()
      }
      const name = (ns != null) ?
        ` ${ns.prefix()}:${aname}` :
        ` ${aname}`
      const val = a.value()
      if (this.opts.html) {
        if (BOOLEAN_ATTRIBUTES.includes(aname) || !val) {
          return name
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
            return `${name}=${escapeAttr(a.value())}`
          }
        }
      }
      return `${name}=${this.quote}${escapeAttr(a.value())}${this.quote}`
    })

    // < >xmlns:bar="urn:example:bar"
    const decls = node.namespaces(true).sort(nsCmp).map((ns) => {
      const p = ns.prefix()
      if (p != null) {
        return ` xmlns:${p}=${this.quote}${ns.href()}${this.quote}`
      } else {
        return ` xmlns=${this.quote}${ns.href()}${this.quote}`
      }
    })
    attrs = attrs.concat(decls)

    // will all the attributes and namespace declarations fit?
    const first = (this.opts.spaces*indent) + kind.name.length + 1
    const tot = attrs.reduce((p, a) => p + a.length, first)
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
      this.out.write('>')
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

      if (kind.elements &&
          !kind.nonempty &&
          !(parentKind != null ? parentKind.mixed : undefined)) {
        this._newline()
        this._indent(indent)
      }

      // </foo>
      return this.out.write(`</${kind.name}>`)
    } else {
      if (kind.void) {
        return this.out.write('>')
      } else {
        if (this.opts.html) {
          // in HTML, if it's not a void element, you MUST output the close tag
          return this.out.write(`></${kind.name}>`)
        } else {
          return this.out.write('/>')
        }
      }
    }
  }

  /**
   * @private
   */
  _printText(node, parentKind, indent) {
    let t = escape(node.text())
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
        } else {
          t = ww(t.trim(), {
            width: this.opts.margin - (this.opts.spaces*indent),
            indent: SPACES.substring(0, this.opts.spaces*indent),
            trim: true
          })
        }
        this.out.write(t)
        this._newline()
        this._indent(indent-1)
      } else {
        return this.out.write(t)
      }
    }
  }

  /**
   * @private
   */
  _print(node, parentKind=null, indent=0) {
    switch (node.type()) {
      case 'element':
        return this._printElement(node, parentKind, indent)
      case 'text':
        if (this.opts.ignore.includes(parentKind.name)) {
          return this.out.write(escape(node.text()))
        } else {
          return this._printText(node, parentKind, indent)
        }
      case 'cdata':
        return this.out.write(`<![CDATA[${node.text()}]]>`)
      case 'comment':
        if (!this.opts.noVersion ||
            (parentKind != null) ||
            (node.prevSibling() != null)) {
          this._newline()
        }
        this._indent(indent)
        return this.out.write(`<!-- ${node.text().trim()} -->`)
      case 'entity_ref':
        return this.out.write(`&${node.name()};`)
      case 'pi':
        return this._printPI(node, parentKind, indent)
      case 'dtd':
        return this._printDTD(node, parentKind, indent)
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
    if (!this.opts.noVersion) {
      if (this.opts.html) {
        const dtd = doc.getDtd()
        if (dtd != null) {
          this.out.write(`<!DOCTYPE ${dtd.name}`)
          if (dtd.externalId != null) {
            this.out.write(
              ` PUBLIC ${this.quote}${dtd.externalId}${this.quote}`)
          }
          if (dtd.systemId != null) {
            this.out.write(` ${this.quote}${dtd.systemId}${this.quote}`)
          }
          this.out.write('>')
        }
      } else {
        this.out.write(
          `<?xml version=${this.quote}${doc.version()}${this.quote}?>`)
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
    return d.printDoc(doc)
  }

  /**
   * Return a string version of the indented document.
   *
   * @param {Buffer|String|libxmljs.Document} src - the source XML or HTML
   * @param {Object} opts - Options passed to Dentin constructor.
   */
  static dentToString(xml, opts = {}) {
    // TODO: It is said that += is faster than Array.prototype.join.  Benchmark.
    const out = []
    opts.output = new stream.Writable({
      decodeStrings: false, // no sense utf8 encoding and decoding
      write(buf, enc, cb) {
        out.push(buf)
        cb()
        return true
      }
    })
    this.dent(xml, opts)
    return out.join('')
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
