import {dirname, join} from 'node:path';
import {CLI} from '../lib/cmd.js';
import {Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import test from 'ava';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Buf extends Transform {
  constructor(opts = {}) {
    const {errorToThrow, ...others} = opts;
    super({
      ...others,
      encoding: 'utf8',
    });
    this.errorToThrow = errorToThrow;
  }

  _transform(chunk, _encoding, cb) {
    if (this.errorToThrow) {
      cb(this.errorToThrow);
    } else {
      this.push(chunk);
      cb();
    }
  }

  static from(str) {
    return new Buf().end(str);
  }
}

test('cmd', async t => {
  const cli = new CLI();
  const s = await cli.cmd([
    join(__dirname, '..', 'examples', 'postal.xml'),
    '-o',
    '/dev/null',
    '-i',
    'artwork',
    '-i',
    'sourcecode',
    '-s',
    '4',
    '-m',
    '78',
  ]);
  t.is(s, undefined);
});

test('bad input', async t => {
  const cli = new CLI();
  cli.yargs.fail(false);
  await t.throwsAsync(() => cli.cmd(['-o', 'foo', '-o', 'bar']));
  await t.throwsAsync(() => cli.cmd(['-b', 'foo', '-b', 'bar']));
  await t.throwsAsync(() => cli.cmd(['-o']));
});

test('backup', async t => {
  let cli = new CLI();
  cli.yargs.fail(false);

  const initial = join(__dirname, '..', 'examples', 'postal.xml');
  const copy = join(__dirname, '..', 'examples', 'postal.xml.copy');
  const copyTest = join(__dirname, '..', 'examples', 'postal.xml.test');
  const out = join(__dirname, '..', 'examples', 'postal.xml.out');
  const config = join(__dirname, '..', '.dentin.json');

  await fs.copyFile(initial, copy);
  await cli.cmd(['-c', config, '--no-colors', '-b', 'test', '-m', '78', copy]);
  let cTxt = await fs.readFile(copy, 'utf8');
  const oTxt = await fs.readFile(out, 'utf8');
  const iTxt = await fs.readFile(initial, 'utf8');
  const ctTxt = await fs.readFile(copyTest, 'utf8');

  t.is(cTxt, oTxt);
  t.is(ctTxt, iTxt);

  await fs.copyFile(initial, copy);
  cli = new CLI();
  cli.yargs.fail(false);
  await cli.cmd(['-c', config, '--no-colors', '-b', '.test', '-m', '78', copy]);
  cTxt = await fs.readFile(copy, 'utf8');
  t.is(cTxt, oTxt);

  await fs.unlink(copy);
  await fs.unlink(copyTest);
});

test('default output', async t => {
  const cli = new CLI();
  cli.defaultOutput = new Buf();
  await cli.cmd(['-m', '78', join(__dirname, '..', 'examples', 'postal.xml')]);
  const out = join(__dirname, '..', 'examples', 'postal.xml.out');
  const expected = await fs.readFile(out, 'utf8');
  t.is(cli.defaultOutput.read(), expected);
});
