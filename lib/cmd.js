import {Dentin} from './dentin.js';
import fs from 'node:fs';
import path from 'node:path';
import {rename} from 'node:fs/promises';
import yargs from 'yargs/yargs';

/**
 * Implement the command line interface.
 */
export class CLI {
  constructor() {
    this.defaultOutput = process.stdout;
    this.yargs = yargs()
      // @ts-ignore
      .usage('$0 [files...]', 'Indent XML or HTML files', y => {
        y.positional('files', {
          default: ['-'],
          defaultDescription: 'stdin',
          desc: 'The files to read. To read stdin explicitly, use "-".',
          normalize: true,
        });
      })
      .options({
        C: {
          alias: 'colors',
          type: 'boolean',
          default: null,
          defaultDescription: 'detect from output stream',
          desc: 'Force colorization',
        },
        i: {
          alias: 'ignore',
          type: 'array',
          desc: 'Ignore elements with these names, do not word-wrap them',
        },
        output: {
          alias: 'o',
          type: 'string',
          desc: 'Output file name',
          defaultDescription: 'stdout',
          requiresArg: true,
          default: '-',
          normalize: true,
        },
        backup: {
          alias: 'b',
          type: 'string',
          requiresArg: true,
          coerce: v => {
            if (!v) {
              return undefined;
            }
            if (typeof v !== 'string') {
              throw new Error('More than one backup extension');
            }
            return v.startsWith('.') ? v : `.${v}`;
          },
          desc: 'Replace the current file, keeping a backup of the original, with the given extension.  This can be used to process several files at once into different output files.',
        },
        c: {
          alias: 'config',
          config: true,
          default: '.dentin.json',
          desc: 'Read configuration information from this JSON file.',
          type: 'string',
          requiresArg: true,
          normalize: true,
        },
        d: {
          alias: 'doubleQuote',
          type: 'boolean',
          default: false,
          desc: 'Use double quotes for attributes',
        },
        m: {
          alias: 'margin',
          type: 'number',
          default: process.stdout.columns - 2,
          defaultDescription: 'terminal width',
          desc: 'Line length for word wrapping',
          requiresArg: true,
        },
        s: {
          alias: 'spaces',
          type: 'number',
          default: 2,
          desc: 'How many spaces to indent each level.  0 causes left alignment.  -1 strips insignificant whitespace.',
          requiresArg: true,
        },
        n: {
          alias: 'noVersion',
          type: 'boolean',
          default: false,
          desc: 'Do not output the XML version or HTML doctype prefix',
        },
        html: {
          type: 'boolean',
          default: null,
          defaultDescription: 'determine from file name',
          desc: 'Process these files as HTML instead of XML',
        },
        periodSpaces: {
          type: 'number',
          default: 2,
          desc: 'Number of spaces you like after a period.  I\'m old, so it is two by default',
          requiresArg: true,
        },
        Q: {
          alias: 'fewerQuotes',
          type: 'boolean',
          default: false,
          desc: 'In HTML docs, only use quotes around attribute values that require them',
        },
      })
      .help()
      .alias('h', 'help')
      .alias('V', 'version');
  }

  /**
   * Implement the command-line interface.
   *
   * @param {string[]} [args] Command-line arguments.
   */
  async cmd(args) {
    const opts = await this.yargs.parse(args);
    if (opts.colors == null) {
      opts.colors = (opts.output === '-') && this.defaultOutput.isTTY;
    }
    for (let d of /** @type {[string]} */(opts.files)) {
      const str = await Dentin.dentFile(d, opts);

      /** @type {NodeJS.WritableStream} */
      let out = this.defaultOutput;
      let fileOpened = false;
      if (opts.backup) {
        const {dir, name} = path.parse(d);
        const bak = path.format({dir, name, ext: opts.backup});
        await rename(d, bak);
        out = fs.createWriteStream(d);
        d = bak;
        fileOpened = true;
      } else if (opts.output !== '-') {
        out = fs.createWriteStream(opts.output);
        fileOpened = true;
      }
      if (fileOpened) {
        await new Promise((resolve, reject) => {
          out.once('error', reject);
          out.once('open', resolve);
        });
      }

      out.write(str);
      if (fileOpened) {
        out.end();
      }
    }
  }
}
