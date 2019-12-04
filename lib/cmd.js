'use strict'

const fs = require('fs')
const path = require('path')
const yargs = require('yargs')
const Dentin = require('./dentin')
const pkg = require('../package')
const util = require('util')
const stat = util.promisify(fs.stat)
const readFile = util.promisify(fs.readFile)
const rename = util.promisify(fs.rename)

/**
 * Implement the command-line interface.
 */
async function cmd(args) {
  const opts = yargs
    .usage('$0 [files...]', 'Indent XML or HTML files', yargs => {
      yargs.positional('files', {
        default: ['-'],
        defaultDescription: 'stdin',
        desc: 'The files to read. To read stdin explicitly, use "-".'
      })
    })
    .options({
      C: {
        alias: 'colors',
        type: 'boolean',
        default: null,
        defaultDescription: 'detect from output stream',
        desc: 'Force colorization'
      },
      i: {
        alias: 'ignore',
        type: 'array',
        desc: 'Ignore elements with these names, do not word-wrap them'
      },
      o: {
        alias: 'output',
        type: 'string',
        desc: 'Output file name',
        defaultDescription: 'stdout',
        conflicts: 'b',
        coerce: v => {
          if (typeof v !== 'string') {
            throw new Error('Error: More than one output file')
          }
          return fs.createWriteStream(v)
        }
      },
      b: {
        alias: 'backup',
        type: 'string',
        coerce: v => {
          if (typeof v !== 'string') {
            throw new Error('More than one backup extension')
          }
          return v.startsWith('.') ? v : '.' + v
        },
        // eslint-disable-next-line max-len
        desc: 'Replace the current file, keeping a backup of the original, with the given extension.  This can be used to process several files at once into different output files.'
      },
      c: {
        alias: 'config',
        config: true,
        default: '.dentin.json',
        desc: 'Read configuration information from this JSON file.'
      },
      d: {
        alias: 'doubleQuote',
        type: 'boolean',
        default: false,
        desc: 'Use double quotes for attributes'
      },
      m: {
        alias: 'margin',
        type: 'number',
        default: 78,
        desc: 'Line length for word wrapping'
      },
      s: {
        alias: 'spaces',
        type: 'number',
        default: 2,
        // eslint-disable-next-line max-len
        desc: 'How many spaces to indent each level.  0 causes left alignment.  -1 strips insignificant whitespace.'
      },
      n: {
        alias: 'noVersion',
        type: 'boolean',
        default: false,
        desc: 'Do not output the XML version or HTML doctype prefix'
      },
      html: {
        type: 'boolean',
        default: null,
        defaultDescription: 'determine from file name',
        desc: 'Process these files as HTML instead of XML'
      },
      periodSpaces: {
        type: 'number',
        default: 2,
        // eslint-disable-next-line max-len
        desc: 'Number of spaces you like after a period.  I\'m old, so it is two by default'
      },
      Q: {
        alias: 'fewerQuotes',
        type: 'boolean',
        default: false,
        // eslint-disable-next-line max-len
        desc: 'In HTML docs, only use quotes around attribute values that require them'
      }
    })
    .help()
    .alias('h', 'help')
    .alias('V', 'version')
    .parse(args)

  let out = (opts.output != null) ? opts.output : process.stdout
  if (opts.colors == null) {
    opts.colors = out.isTTY
  }
  for (let d of opts.files) {
    if (opts.backup) {
      const {dir, name} = path.parse(d)
      const bak = path.format({dir, name, ext: opts.backup})
      await rename(d, bak)
      out = fs.createWriteStream(d)
      d = bak
    }
    const str = await Dentin.dentFile(d, opts)
    out.write(str)
    if (opts.backup) {
      out.end()
      out = null
    }
  }
  if (out) {
    out.end()
  }
}

module.exports = cmd
