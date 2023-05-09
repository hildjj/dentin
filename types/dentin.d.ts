/// <reference types="node" />
export = Dentin;
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
declare class Dentin {
    /**
     * Indent some XML or HTML with the given options.
     *
     * @param {Buffer|string|xmljs.Document} src The source XML or HTML.
     * @param {DentinOptions} opts Options passed to Dentin constructor.
     * @returns {string} The indented version.
     */
    static dent(src: Buffer | string | xmljs.Document, opts?: DentinOptions): string;
    /**
     * Indent a file.  If the `html` option is not explicitly set, figure it
     * out from the file name.
     *
     * @param {string} fileName The file to read.
     * @param {object} opts Options passed to Dentin constructor.
     * @returns {string} The indented version.
     */
    static dentFile(fileName: string, opts: object): string;
    /**
     * Create an instance of a Dentin.
     *
     * @param {DentinOptions} opts Configuration options.
     */
    constructor(opts?: DentinOptions);
    opts: {
        /**
         * Colorize output.  If null, colorize
         * if the terminal supports it.
         */
        colors: boolean;
        /**
         * Use double quotes instead
         * of single.
         */
        doubleQuote: boolean;
        /**
         * In HTML docs, only use quotes
         * around attribute values that require them.
         */
        fewerQuotes: boolean;
        /**
         * Use HTML rules instead of XML rules.
         */
        html: boolean;
        /**
         * Don't alter whitespace for the
         * text inside these elements.
         */
        ignore: string[];
        /**
         * Line length for word wrapping.
         */
        margin: number;
        /**
         * Don't output XML version header.
         */
        noVersion: boolean;
        /**
         * Number of spaces to indent each level.
         */
        spaces: number;
        /**
         * Number of spaces you like after
         * a period.  I'm old, so it's two by default.
         */
        periodSpaces: number;
        /**
         * Colors to use for printing.
         */
        theme: Theme;
    };
    chalk: chalk.Chalk;
    noChalk: chalk.Chalk;
    quote: string;
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
    printNode(node: xmljs.Document | xmljs.Element | xmljs.Text | xmljs.Comment | xmljs.ProcessingInstruction): string;
}
declare namespace Dentin {
    export { Color, Theme, DentinOptions };
}
type Theme = {
    /**
     * Punctuation like "<" and ">".
     */
    PUNCTUATION: Color;
    /**
     * Element names.
     */
    ELEMENT: Color;
    /**
     * Attribute names.
     */
    ATTRIBUTE: Color;
    /**
     * Attribute values.
     */
    ATTRIBUTE_VALUE: Color;
    /**
     * Running text.
     */
    TEXT: Color;
};
import chalk = require("chalk");
import xmljs = require("libxmljs2");
import { Buffer } from "buffer";
type DentinOptions = {
    /**
     * Colorize output.  If null, colorize
     * if the terminal supports it.
     */
    colors?: boolean;
    /**
     * Use double quotes instead
     * of single.
     */
    doubleQuote?: boolean;
    /**
     * In HTML docs, only use quotes
     * around attribute values that require them.
     */
    fewerQuotes?: boolean;
    /**
     * Use HTML rules instead of XML rules.
     */
    html?: boolean;
    /**
     * Don't alter whitespace for the
     * text inside these elements.
     */
    ignore?: string[];
    /**
     * Line length for word wrapping.
     */
    margin?: number;
    /**
     * Don't output XML version header.
     */
    noVersion?: boolean;
    /**
     * Number of spaces to indent each level.
     */
    spaces?: number;
    /**
     * Number of spaces you like after
     * a period.  I'm old, so it's two by default.
     */
    periodSpaces?: number;
    /**
     * Colors to use for printing.
     */
    theme?: Theme;
};
type Color = string | number[];
