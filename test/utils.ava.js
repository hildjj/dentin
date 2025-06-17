'use strict';

const test = require('ava');
const chalk = require('chalk');
const utils = require('../lib/utils');

test('setChalkTheme', t => {
  const c = new chalk.Instance({level: 3});
  utils.setChalkTheme(c, {
    tESTME: '0xbeefee',
  });
  t.is(typeof c.tESTME, 'function');
  const s = c`{tESTME foo}`;
  t.is(typeof s, 'string');
  t.not(s, 'foo');
  t.not(s, '{tESTME foo}');
  const s2 = c.tESTME('foo');
  t.is(s, s2);
});

test('extract', t => {
  t.is(utils.extract(null, ['foo', 'bar']), null);
  t.is(utils.extract(null, null), null);
  t.deepEqual(utils.extract({a: 1}, null), {});
  t.deepEqual(utils.extract({foo: 1, baz: 2}, ['foo', 'bar']), {foo: 1});
});
