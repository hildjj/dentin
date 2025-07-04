import {extract, setChalkTheme} from '../lib/utils.js';
import {Chalk} from 'chalk';
import test from 'ava';

test('setChalkTheme', t => {
  const c = new Chalk({level: 3});
  const tmp = setChalkTheme(c, {
    tESTME: '0xbeefee',
  });
  t.is(typeof c.tESTME, 'function');
  const s = tmp`{tESTME foo}`;
  t.is(typeof s, 'string');
  t.not(s, 'foo');
  t.not(s, '{tESTME foo}');
  const s2 = c.tESTME('foo');
  t.is(s, s2);
});

test('extract', t => {
  t.is(extract(null, ['foo', 'bar']), null);
  t.is(extract(null, null), null);
  t.deepEqual(extract({a: 1}, null), {});
  t.deepEqual(extract({foo: 1, baz: 2}, ['foo', 'bar']), {foo: 1});
});
