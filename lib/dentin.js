'use strict'

const fs = require('fs')
const assert = require('assert')
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
      res = 1
    }
  } else if (b == null) {
    res = -1
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

function collect(val, memo) {
  memo.push(val)
  return memo
}

class Denter {
  constructor(opts = {}) {
    this.opts = Object.assign({
      html: false,
      noVersion: false,
      rightMargin: 70,
      indentSpaces: 2,
      doubleQuote: false,
      ignore: [],
      output: null
    }, opts)

    this.quote = this.opts.doubleQuote ? '"' : '\''
    if (typeof opts.output === 'function') {
      this.file = null
      this.out = opts.output
    } else if (typeof this.opts.output === 'string') {
      this.file = fs.openSync(this.opts.output, 'w')
      this.out = fs.writeSync.bind(fs, this.file)
    } else {
      this.file = null
      this.out = process.stdout.write.bind(process.stdout)
    }
  }

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
          console.error(`Void element '${kind.name}' ` +
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
          console.error(`unknown node type: ${c.type()}`)
      }
    }

    kind.mixed = kind.elements && kind.nonempty
    return kind
  }

  _printPI(node, out, parentKind, indent) {
    if (!this.opts.noVersion ||
        (typeof parentKind !== 'undefined' && parentKind !== null) ||
        (node.prevSibling() != null)) {
      out('\n')
    }
    out(spaces(this.opts.indentSpaces*indent))

    // TODO: turn dquote into quote, even though it's technically wrong?
    return out(`<?${node.name()} ${node.text()}?>`)
  }

  _printDTD(node, out, parentKind, indent) {
    const t = node.toString()
    if (t) {
      if (!this.opts.noVersion ||
          (typeof parentKind !== 'undefined' && parentKind !== null) ||
          (node.prevSibling() != null)) {
        out('\n')
      }
      out(spaces(this.opts.indentSpaces*indent))

      // TODO: don't punt.
      return out(t)
    }
  }

  _printElement(node, out, parentKind, indent) {
    const kind = this._elKind(node)
    kind.mixed = kind.mixed ||
      (parentKind != null ? parentKind.mixed : undefined)

    // If this the parent is mixed, we don't want a newline or an indent.
    if (!(parentKind != null ? parentKind.mixed : undefined)) {
      // If we're not outputting a version string, and this is the root,
      // we don't want a newline.
      if (!this.opts.noVersion || (parentKind != null)) {
        out('\n')
      }
      out(spaces(this.opts.indentSpaces*indent))
    }

    // <foo
    out(`<${kind.name}`)

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
    if ((this.opts.rightMargin > 0) && (tot > this.opts.rightMargin)) {
      // no, they don't fit
      // each attribute on a new line, except first
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i]
        if (i > 0) {
          out('\n')
          out(spaces(first))
        }
        out(a)
        kind.right_pos = first + attrs[attrs.length-1].length + 1
      }
    } else {
      // yes, they fit
      kind.right_pos = first+1
      for (const a of attrs) {
        out(a)
        kind.right_pos += a.length
      }
    }

    // any children?
    if (kind.text || kind.elements) {
      // yes
      out('>')
      const new_indent = indent+1

      if (kind.mixed) {
        const rm = this.opts.rightMargin
        this.opts.rightMargin = -1
        for (const c of node.childNodes()) {
          this._print(c, out, kind, 0)
        }
        this.opts.rightMargin = rm
      } else {
        for (const c of node.childNodes()) {
          this._print(c, out, kind, new_indent)
        }
      }

      if (kind.elements && 
          !kind.nonempty &&
          !(parentKind != null ? parentKind.mixed : undefined)) {
        out(`\n${spaces(this.opts.indentSpaces*indent)}`)
      }

      // </foo>
      return out(`</${kind.name}>`)
    } else {
      if (kind.void) {
        return out('>')
      } else {
        if (this.opts.html) {
          // in HTML, if it's not a void element, you MUST output the close tag
          return out(`></${kind.name}>`)
        } else {
          return out('/>')
        }
      }
    }
  }

  _printText(node, out, parentKind, indent) {
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

      if ((this.opts.rightMargin > 0) && (len > this.opts.rightMargin)) {
        out('\n')
        t = ww(t.trim(), {
          width: this.opts.rightMargin - (this.opts.indentSpaces*indent),
          indent: spaces(this.opts.indentSpaces*indent),
          trim: true
        }
        )
        out(t)
        out('\n')
        return out(spaces(this.opts.indentSpaces*(indent-1)))
      } else {
        return out(t)
      }
    }
  }

  _print(node, out, parentKind=null, indent) {
    if (indent == null) {
      indent = 0
    }
    switch (node.type()) {
      case 'element':
        return this._printElement(node, out, parentKind, indent)
      case 'text':
        if (this.opts.ignore.includes(parentKind.name)) {
          return out(escape(node.text()))
        } else {
          return this._printText(node, out, parentKind, indent)
        }
      case 'cdata':
        return out(`<![CDATA[${node.text()}]]>`)
      case 'comment':
        if (!this.opts.noVersion ||
            (parentKind != null) ||
            (node.prevSibling() != null)) {
          out('\n')
        }
        out(spaces(this.opts.indentSpaces*indent))
        return out(`<!-- ${node.text().trim()} -->`)
      case 'entity_ref':
        return out(`&${node.name()};`)
      case 'pi':
        return this._printPI(node, out, parentKind, indent)
      case 'dtd':
        return this._printDTD(node, out, parentKind, indent)
      default:
        return console.error(`Unknown node print: ${node.type()}`)
    }
  }

  printDoc(doc) {
    if (!this.opts.noVersion) {
      if (this.opts.html) {
        const dtd = doc.getDtd()
        if (dtd != null) {
          this.out(`<!DOCTYPE ${dtd.name}`)
          if (dtd.externalId != null) {
            this.out(` PUBLIC ${this.quote}${dtd.externalId}${this.quote}`)
          }
          if (dtd.systemId != null) {
            this.out(` ${this.quote}${dtd.systemId}${this.quote}`)
          }
          this.out('>')
        }
      } else {
        this.out(`<?xml version=${this.quote}${doc.version()}${this.quote}?>`)
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
      this._print(node, this.out)
      node = node.nextSibling()
    }
    this.out('\n')

    if (this.file != null) {
      return fs.close(this.file)
    }
  }

  static dent(xml, opts={}) {
    let doc = null
    if ((typeof xml == 'string') || Buffer.isBuffer(xml)) {
      if ((opts != null ? opts.html : undefined)) {
        doc = xmljs.parseHtml(xml)
      } else {
        doc =xmljs.parseXml(xml)
      }
    } else if (xml instanceof xmljs.Document) {
      doc = xml
    } else {
      throw new Error('invalid argument (xml)')
    }
  
    return new Denter(opts).printDoc(doc)
  }

  static dentToString(xml, opts = {}) {
    let out = ''
    const collect = (...all) => all.map(a => out += a)
    opts.output = collect
    this.dent(xml, opts)
    return out
  }

  static dentFile(file_name, opts) {
    return new Promise((resolve, reject) => {
      const str = (file_name === '-') ?
        process.stdin : fs.createReadStream(file_name)
      const bufs = []
      str.on('data', b => bufs.push(b))
      str.on('error', reject)
      str.on('end', () => {
        try {
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
    program
      .version(pkg.version)
      .option('-i, --ignore <name>',
        'Ignore elements with name for wrapping []', collect, [])
      .option('-o, --output <file>', 'Output file name [stdout]')
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
  
    if ((program.html == null) && program.args[0].match(/.html?$/)) {
      program.html = true
    }

    const opts = await this.readConfig(program)
    for (const d of program.args) {
      await this.dentFile(d, opts)
    }
  }
}

module.exports = Denter
