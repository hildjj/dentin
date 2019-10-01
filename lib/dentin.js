'use strict'

const fs = require('fs')
const stream = require('stream')
const xmljs = require('libxmljs')
const ww = require('word-wrap')

// FIXME: I don't remember what I was thinking here.
const DEFAULT_CONFIG = './.dentin.json'

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&apos;',
  '\xA0': '&nbsp;'
}

const SPACES = new Array(256).join(' ')
function spaces(n) {
  return SPACES.substring(0, n)
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
   * @param {Boolean} [html=false] - use HTML rules instead of XML rules.
   * @param {Boolean} [noVersion=false] - Don't output XML version header
   * @param {Number} [margin=70] - word wrap when we get to this column
   * @param {Number} [indentSpaces=2] - number of spaces to indent each level
   * @param {Boolean} [doubleQuote=false] - use double quotes instead of single
   * @param {Array<String>} [ignore=[]] - don't alter whitespace for the text
   *   inside these elements
   * @param {stream.Writable} [output=null] - stream to write output to.
   *   If null, process.stdout is used.
   */
  constructor(opts = {}) {
    this.opts = Object.assign({
      html: false,
      noVersion: false,
      margin: 70,
      indentSpaces: 2,
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
      kind.void = [
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
      ].includes(kind.name)
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
      this.out.write('\n')
    }
    this.out.write(spaces(this.opts.indentSpaces*indent))

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
        this.out.write('\n')
      }
      this.out.write(spaces(this.opts.indentSpaces*indent))

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
        this.out.write('\n')
      }
      this.out.write(spaces(this.opts.indentSpaces*indent))
    }

    // <foo
    this.out.write(`<${kind.name}`)

    // < >boo="baz"
    let attrs = node.attrs().sort(attrCmp).map(a => {
      const ns = a.namespace()
      const name = (ns != null) ?
        ` ${ns.prefix()}:${a.name()}` :
        ` ${a.name()}`
      const val = a.value()
      if (this.opts.html && !val) {
        return name
      } else {
        return `${name}=${this.quote}${escapeAttr(a.value())}${this.quote}`
      }
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
    const first = (this.opts.indentSpaces*indent) + kind.name.length + 1
    const tot = attrs.reduce((p, a) => p + a.length, first)
    if ((this.opts.margin > 0) && (tot > this.opts.margin)) {
      // no, they don't fit
      // each attribute on a new line, except first
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i]
        if (i > 0) {
          this.out.write('\n')
          this.out.write(spaces(first))
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
        this.opts.margin = -1
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
        this.out.write(`\n${spaces(this.opts.indentSpaces*indent)}`)
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

      if ((this.opts.margin > 0) && (len > this.opts.margin)) {
        this.out.write('\n')
        t = ww(t.trim(), {
          width: this.opts.margin - (this.opts.indentSpaces*indent),
          indent: spaces(this.opts.indentSpaces*indent),
          trim: true
        }
        )
        this.out.write(t)
        this.out.write('\n')
        return this.out.write(spaces(this.opts.indentSpaces*(indent-1)))
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
          this.out.write('\n')
        }
        this.out.write(spaces(this.opts.indentSpaces*indent))
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
    this.out.write('\n')
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

  static async readConfig(opts = {}) {
    let cfg
    if (typeof opts === 'string') {
      cfg = opts
      opts = {}
    } else {
      cfg = (opts.config != null) ? opts.config : DEFAULT_CONFIG
    }
    try {
      await fs.promises.stat(cfg)
    } catch (_) {
      return opts
    }
    const data = await fs.promises.readFile(cfg)
    const config = JSON.parse(data)
    const ignore = opts.ignore || []
    opts = Object.assign(opts, config)
    opts.ignore = ignore.concat(config.ignore)
    return opts
  }

  static async cmd(args) {
    const commander = require('commander')
    const pkg = require('../package')
    const program = new commander.Command

    const pi = n => parseInt(n)
    const collect = (val, memo) => {
      memo.push(val)
      return memo
    }

    program
      .version(pkg.version)
      .option('-i, --ignore <name>',
        'Ignore elements with name for wrapping []', collect, [])
      .option('-o, --output <file>', 'Output file name [stdout]',
        (val, memo) => fs.createWriteStream(val))
      .option('-c, --config <file>', `Config file to read [${DEFAULT_CONFIG}]`,
        DEFAULT_CONFIG)
      .option('-d, --doubleQuote', 'Use double quotes for attributes [false]',
        false)
      .option('-m, --margin <int>', 'Right margin in spaces [78]', pi, 78)
      .option('-s, --spaces <int>', 'Number of spaces to indent [2]', pi, 2)
      .option('-n, --noVersion', 'Don\'t output xml version prefix [false]')
      .option('--html',
        'Parse and generate HTML instead of XML [look at filename]')
      .usage('[options] [file...]')
      .parse(args)
  
    if (program.args.length === 0) {
      program.args.push('-')
    }
  
    const opts = await this.readConfig(program)
    for (const d of program.args) {
      await this.dentFile(d, opts)
    }
    if (opts.output) {
      opts.output.close()
    }
  }
}

module.exports = Dentin
