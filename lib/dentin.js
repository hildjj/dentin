import {Chalk, default as chalk} from 'chalk';
import {parseHtml, parseXml} from 'libxmljs2';
import {Buffer} from 'node:buffer';
import {create} from './wrapper.js';
import {createReadStream} from 'node:fs';
import {setChalkTheme} from './utils.js';

/** @import * as xmljs from 'libxmljs2' */

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
};

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
 * @property {number} [right] TODO: Document.
 */

/**
 * Indent XML or HTML.
 *
 * @class
 */
export class Dentin {
  /** @type {Required<DentinOptions>} */
  opts;

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
      right: 0,
      spaces: 2,
      theme: DEFAULT_THEME,
      ...opts,
    };

    const level = this.opts.colors ? chalk.level : 0;
    this.chalk = setChalkTheme(new Chalk({level}), this.opts.theme);
    this.noChalk = setChalkTheme(new Chalk({level: 0}), this.opts.theme);
    this.quote = this.opts.doubleQuote ? '"' : '\'';
  }

  /**
   * Print a DOM node, including a full document.
   *
   * @param {xmljs.Node | xmljs.Document} node The Node to print.
   * @returns {string} The indented version.
   */
  printNode(node) {
    const k = create(this, node);
    return k.print().str;
  }

  /**
   * Indent some XML or HTML with the given options.
   *
   * @param {Buffer|string|xmljs.Document} src The source XML or HTML.
   * @param {DentinOptions} opts Options passed to Dentin constructor.
   * @returns {string} The indented version.
   */
  static dent(src, opts = {}) {
    let doc = null;
    if ((typeof src === 'string') || Buffer.isBuffer(src)) {
      if (opts.html) {
        // @ts-expect-error Buffer also works.
        doc = parseHtml(src);
      } else {
        // @ts-expect-error Buffer also works.
        doc = parseXml(src);
      }
    } else {
      doc = src;
    }

    const d = new Dentin(opts);
    return d.printNode(doc);
  }

  /**
   * Indent a file.  If the `html` option is not explicitly set, figure it
   * out from the file name.
   *
   * @param {string} fileName The file to read.
   * @param {object} opts Options passed to Dentin constructor.
   * @returns {Promise<string>} The indented version.
   */
  static dentFile(fileName, opts) {
    return new Promise((resolve, reject) => {
      const str = (fileName === '-') ?
        process.stdin :
        createReadStream(fileName);
      const bufs = [];
      str.on('data', b => bufs.push(b));
      str.on('error', reject);
      str.on('end', () => {
        try {
          if ((opts.html == null) && fileName.match(/.html?$/)) {
            opts.html = true;
          }
          resolve(this.dent(Buffer.concat(bufs), opts));
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
