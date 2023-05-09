'use strict'

const fs = require('fs')
const xmljs = require('libxmljs2')
const chalk = require('chalk')
const {setChalkTheme} = require('./utils')
const Wrapper = require('./wrapper')
const {Buffer} = require('buffer')

/**
 * @typedef {string|number[]} Color
 */
/**
 * @typedef {object} Theme
 * @property {Color} PUNCTUATION Punctuation like "<" and ">".
 * @property {Color} ELEMENT Element names.
 * @property {Color} ATTRIBUTE Attribute names.
 * @property {Color} ATTRIBUTE_VALUE Attribute values.
 * @property {Color} TEXT Running text.
 */
/** @type {Theme} */
const DEFAULT_THEME = {
  PUNCTUATION: 'dim',
  ELEMENT: [0, 116, 232],
  ATTRIBUTE: 'magenta',
  ATTRIBUTE_VALUE: [221, 0, 169],
  TEXT: 'reset',
}

/**
 * @typedef {object} DentinOptions
 * @property {boolean} [colors=false] Colorize output.  If null, colorize
 *   if the terminal supports it.
 * @property {boolean} [doubleQuote=false] Use double quotes instead
 *   of single.
 * @property {boolean} [fewerQuotes=false] In HTML docs, only use quotes
 *   around attribute values that require them.
 * @property {boolean} [html=false] Use HTML rules instead of XML rules.
 * @property {string[]} [ignore=[]] Don't alter whitespace for the
 *   text inside these elements.
 * @property {number} [margin=78] Line length for word wrapping.
 * @property {boolean} [noVersion=false] Don't output XML version header.
 * @property {number} [spaces=2] Number of spaces to indent each level.
 * @property {number} [periodSpaces=2] Number of spaces you like after
 *   a period.  I'm old, so it's two by default.
 * @property {Theme} [theme=DEFAULT_THEME] Colors to use for printing.
 */

/**
 * Indent XML or HTML.
 *
 * @class
 */
class Dentin {
  /**
   * Create an instance of a Dentin.
   *
   * @param {DentinOptions} opts Configuration options.
   */
  constructor(opts = {}) {
    this.opts = {
      colors: true,
      doubleQuote: false,
      fewerQuotes: false,
      html: false,
      ignore: [],
      margin: 78,
      noVersion: false,
      periodSpaces: 2,
      spaces: 2,
      theme: DEFAULT_THEME,
      ...opts,
    }

    const level = this.opts.colors ? chalk.level : 0
    this.chalk = new chalk.Instance({level})
    setChalkTheme(this.chalk, this.opts.theme)
    this.noChalk = new chalk.Instance({level: 0})
    setChalkTheme(this.noChalk, this.opts.theme)
    this.quote = this.opts.doubleQuote ? '"' : '\''
  }

  /**
   * @typedef { xmljs.Comment |
   *   xmljs.Document |
   *   xmljs.Element |
   *   xmljs.Text |
   *   xmljs.ProcessingInstruction } XmlNode
   */

  /**
   * Print a DOM node, including a full document.
   *
   * @param {XmlNode} node The Node to print.
   * @returns {string} The indented version.
   */
  printNode(node) {
    const k = Wrapper.create(this, node)
    return k.print().str
  }

  /**
   * Indent some XML or HTML with the given options.
   *
   * @param {Buffer|string|xmljs.Document} src The source XML or HTML.
   * @param {DentinOptions} opts Options passed to Dentin constructor.
   * @returns {string} The indented version.
   */
  static dent(src, opts = {}) {
    let doc = null
    if ((typeof src === 'string') || Buffer.isBuffer(src)) {
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
   * @param {string} fileName The file to read.
   * @param {object} opts Options passed to Dentin constructor.
   * @returns {string} The indented version.
   */
  static dentFile(fileName, opts) {
    return new Promise((resolve, reject) => {
      const str = (fileName === '-') ?
        process.stdin :
        fs.createReadStream(fileName)
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
