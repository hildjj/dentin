'use strict'

const fs = require('fs')
const commander = require('commander')
const Dentin = require('./dentin')
const pkg = require('../package')
const util = require('util')
const stat = util.promisify(fs.stat)
const readFile = util.promisify(fs.readFile)

// FIXME: I don't remember what I was thinking here, but I needed something
// like this for the RFC work.
const DEFAULT_CONFIG = './.dentin.json'

/**
 * @private
 */
async function _readConfig(opts = {}) {
  let cfg
  if (typeof opts === 'string') {
    cfg = opts
    opts = {}
  } else {
    cfg = opts.config
  }
  if (cfg != null) {
    try {
      await stat(cfg)
    } catch (_) {
      return opts
    }
    const data = await readFile(cfg)
    const config = JSON.parse(data)
    const ignore = opts.ignore || []
    opts = Object.assign(opts, config)
    opts.ignore = ignore.concat(config.ignore)
  }
  return opts
}

/**
 * Implement the command-line interface.
 */
async function cmd(args) {
  const program = new commander.Command()

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

  const opts = await _readConfig(program)
  for (const d of program.args) {
    await Dentin.dentFile(d, opts)
  }
  if (opts.output) {
    opts.output.close()
  }
}

cmd._readConfig = _readConfig
module.exports = cmd
