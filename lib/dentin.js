'use strict'

const fs = require('fs')
const xmljs = require('libxmljs')
const chalk = require('chalk')
const {setChalkTheme} = require('./utils')
const Wrapper = require('./wrapper')

const DEFAULT_THEME = {
  PUNCTUATION: 'dim',
  ELEMENT: [0, 116, 232],
  ATTRIBUTE: 'magenta',
  ATTRIBUTE_VALUE: [221, 0, 169],
  TEXT: 'reset'
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
   * @param {Boolean|null} [colors=false] - colorize output.  If null, colorize
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
   * @param {Number} [opts.spaces=2] - number of spaces to indent each level
   * @param {Number} [opts.periodSpaces=2] - number of spaces you like after
   *   a period.  I'm old, so it's two by default
   * @param {Theme} [opts.theme=DEFAULT_THEME] - Colors to use for printing
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
      periodSpaces: 2,
      spaces: 2,
      theme: DEFAULT_THEME
    }, opts)

    const level = this.opts.colors ? chalk.level : 0
    this.chalk = new chalk.Instance({level})
    setChalkTheme(this.chalk, this.opts.theme)
    this.noChalk = new chalk.Instance({level: 0})
    setChalkTheme(this.noChalk, this.opts.theme)
    this.quote = this.opts.doubleQuote ? '"' : '\''
  }

  /**
   * Print a DOM node, including a full document.
   *
   * @param {libxmljs.*} node - The Node to print
   * @return {String} - The indented version
   */
  printNode(node) {
    const k = Wrapper
  .create(this, node)
    return k.print().str
  }

  /**
   * Indent some XML or HTML with the given options.
   *
   * @param {Buffer|String|libxmljs.Document} src - the source XML or HTML
   * @param {Object} opts - Options passed to Dentin constructor.
   * @return {String} - The indented version
   */
  static dent(src, opts={}) {
    let doc = null
    if ((typeof src == 'string') || Buffer.isBuffer(src)) {
      if (opts.html) {
        doc = xmljs.parseHtml(src)
      } else {
        doc = xmljs.parseXml(src)
      }
    } else {
      doc = src
    }

    const d = new Dentin(opts)
    return d.printNode(doc)
  }

  /**
   * Indent a file.  If the `html` option is not explicitly set, figure it
   * out from the file name.
   *
   * @param {String} fileName - The file to read
   * @param {Object} opts - Options passed to Dentin constructor.
   * @return {String} - The indented version
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
          resolve(this.dent(Buffer.concat(bufs), opts))
        } catch (e) {
          reject(e)
        }
      })
    })
  }
}

module.exports = Dentin
