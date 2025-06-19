import {Element, parseHtml} from 'libxmljs2';
import {dirname, join} from 'node:path';
import {Dentin} from '../lib/dentin.js';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import test from 'ava';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('dent', t => {
  const out = Dentin.dent(
    '<foo xmlns:foo="urn:foo" y="n&apos;&amp;>"><foo:bar foo:x="y"/></foo>',
    {colors: false}
  );
  t.deepEqual(out, `<?xml version='1.0'?>
<foo y='n&apos;&amp;&gt;' xmlns:foo='urn:foo'>
  <foo:bar foo:x='y'/>
</foo>\n`);
});

test('constructor', t => {
  const d = new Dentin();
  t.is(typeof d.opts.theme, 'object');
  delete d.opts.theme;
  t.deepEqual(d.opts, {
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
  });
  t.truthy(d.quote.includes('\''));
});

test('sorting', t => {
  let doc = Dentin.dent(`<foo
    b='bb'
    xmlns:c='urn:c'
    xmlns:b='urn:b'
    xmlns:d='urn:d'
    c:d='cd'
    c:c='cc'
    c:e='ce'
    a='aa'
    c='cc'
    b:b='bbb'/>`, {colors: false});
  t.is(doc, `<?xml version='1.0'?>
<foo a='aa'
     b='bb'
     c='cc'
     b:b='bbb'
     c:c='cc'
     c:d='cd'
     c:e='ce'
     xmlns:b='urn:b'
     xmlns:c='urn:c'
     xmlns:d='urn:d'/>\n`);
  doc = Dentin.dent(`<foo
    xmlns:c='urn:c'
    xmlns='urn:a'
    xmlns:b='urn:b'
    b='bb'
    a='aa'/>`, {noVersion: true, doubleQuote: true, colors: false});
  t.is(doc,
    '<foo a="aa" b="bb" xmlns="urn:a" xmlns:b="urn:b" xmlns:c="urn:c"/>\n');
});
test('examples', async t => {
  const dn = join(__dirname, '..', 'examples');
  const dir = await fs.readdir(dn);
  t.truthy(dir.length > 0);
  for (const fx of dir.filter(f => f.endsWith('.xml'))) {
    const input = await fs.readFile(join(dn, fx));
    const output = await fs.readFile(join(dn, `${fx}.out`), 'utf8');
    const s = Dentin.dent(input, {
      ignore: [
        'artwork',
        'sourcecode',
      ],
      margin: 78,
      colors: false,
    });
    t.is(s, output, fx);
  }
  for (const fh of dir.filter(f => f.endsWith('.html'))) {
    const expected = await fs.readFile(join(dn, `${fh}.out`), 'utf8');
    const s = await Dentin.dentFile(join(dn, fh), {
      colors: false,
      margin: 78,
    });
    t.is(s, expected, fh);
  }
});
test('errors', async t => {
  // Force a malformed HTML text; the parser doesn't generate these.
  const doc = parseHtml('<br>');
  const br = doc.get('body/br');
  br.addChild(new Element(doc, 'p', 'text'));
  t.throws(() => Dentin.dent(doc, {
    colors: false,
    html: true,
    noVersion: true,
  }));
  t.throws(() => {
    Dentin.dent(true);
  });
  await t.throwsAsync(
    () => Dentin.dentFile(join(__dirname, '..', 'package.json'))
  );
});

test('html', t => {
  const doc = Dentin.dent(`<INPUT DISABLED=TRUE type="text"
  placeholder="foo=bar"></input>`, {
    colors: false,
    html: true,
    fewerQuotes: true,
    noVersion: true,
  });
  t.is(doc, `<html>
  <body>
    <input disabled placeholder='foo=bar' type=text>
  </body>
</html>\n`);
});

test('small spaces', t => {
  let doc = Dentin.dent('<foo><bar/></foo>', {
    colors: false,
    spaces: 0,
    noVersion: true,
  });
  t.is(doc, `<foo>
<bar/>
</foo>\n`);

  doc = Dentin.dent(`<foo>
    <bar>aaaaa \
bbbbb
    ccccc\
    ddddd
\teeeee fffff</bar>
</foo>\n`, {
    colors: false,
    spaces: -1,
    margin: 15,
    noVersion: true,
  });
  t.is(doc, '<foo><bar>aaaaa bbbbb ccccc ddddd eeeee fffff</bar></foo>');
});

test('PI', t => {
  let doc = Dentin.dent('<?boo?><foo><?huh hah?></foo><?yep?>', {
    colors: false,
    noVersion: true,
  });
  t.is(doc, `<?boo?>
<foo>
  <?huh hah?>
</foo>
<?yep?>\n`);

  // Make sure we don't add a leading newline for this comment
  doc = Dentin.dent('<!-- cmt --><foo/>', {
    colors: false,
    noVersion: true,
  });
  t.is(doc, '<!-- cmt -->\n<foo/>\n');
});

test('DTD', t => {
  // Short doctypes on one line
  const doc = Dentin.dent(`<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test PUBLIC
  'stuff'
  'things'>
<test/>`, {
    colors: false,
  });
  t.is(doc, `<?xml version='1.0'?>
<!DOCTYPE test PUBLIC 'stuff' 'things'>
<test/>\n`);
});
