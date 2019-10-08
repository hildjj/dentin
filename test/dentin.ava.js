'use strict'

const fs = require('fs')
const path = require('path')
const test = require('ava')
const libxmljs = require('libxmljs')
const Dentin = require('../lib/dentin')
const util = require('util')
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const {StringWriter} = require('../lib/utils')

test('dentToString', t => {
  const out = Dentin.dentToString(
    '<foo xmlns:foo="urn:foo" y="n&apos;&amp;>"><foo:bar foo:x="y"/></foo>', {
      colors: false
    })
  t.deepEqual(out, `<?xml version='1.0'?>
<foo y='n&apos;&amp;&gt;' xmlns:foo='urn:foo'>
  <foo:bar foo:x='y'/>
</foo>\n`)
})

test('constructor', t => {
  const d = new Dentin()
  t.is(typeof d.opts.theme, 'object')
  delete d.opts.theme
  t.deepEqual(d.opts, {
    colors: true,
    html: false,
    fewerQuotes: false,
    noVersion: false,
    margin: 78,
    spaces: 2,
    doubleQuote: false,
    ignore: [],
    output: null
  })
  t.truthy(d.quote.includes('\''))
  t.is(typeof d.out.write, 'function')
})

test('sorting', t => {
  let doc = Dentin.dentToString(`<foo
    b='bb'
    xmlns:c='urn:c'
    xmlns:b='urn:b'
    xmlns:d='urn:d'
    c:d='cd'
    c:c='cc'
    c:e='ce'
    a='aa'
    c='cc'
    b:b='bbb'/>`, {colors: false})
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
     xmlns:d='urn:d'/>\n`)
  doc = Dentin.dentToString(`<foo
    xmlns:c='urn:c'
    xmlns='urn:a'
    xmlns:b='urn:b'
    b='bb'
    a='aa'/>`, {noVersion: true, doubleQuote: true, colors: false})
  t.is(doc,
    '<foo a="aa" b="bb" xmlns="urn:a" xmlns:b="urn:b" xmlns:c="urn:c"/>\n')
})
test('examples', async t => {
  const dn = path.join(__dirname, '..', 'examples')
  const dir = await readdir(dn)
  t.truthy(dir.length > 0)
  for (const fx of dir.filter(f => f.endsWith('.xml'))) {
    const input = await readFile(path.join(dn, fx))
    const output = await readFile(path.join(dn, fx + '.out'), 'utf8')
    const s = Dentin.dentToString(input, {
      ignore: [
        'artwork',
        'sourcecode'
      ],
      margin: 78,
      colors: false
    })
    t.is(s, output, fx)
  }
  for (const fh of dir.filter(f => f.endsWith('.html'))) {
    const expected = await readFile(path.join(dn, fh + '.out'), 'utf8')
    const output = new StringWriter()
    await Dentin.dentFile(path.join(dn, fh), {
      colors: false,
      margin: 78,
      output
    })
    t.is(output.read(), expected, fh)
  }
})
test('errors', async t => {
  // force a malformed HTML text; the parser doesn't generate these.
  const doc = libxmljs.parseHtml('<br>')
  const br = doc.get('body/br')
  br.addChild(new libxmljs.Element(doc, 'p', 'text'))
  const output = new StringWriter()
  t.throws(() => {
    return Dentin.dent(doc, {
      colors: false,
      html: true,
      noVersion: true,
      output
    })
  })
  t.throws(() => {
    Dentin.dent(true)
  })
  await t.throwsAsync(() => {
    return Dentin.dentFile(path.join(__dirname, '..', 'package.json'))
  })
})

test('html', t => {
  const doc = Dentin.dentToString('<INPUT DISABLED=TRUE type="text" placeholder="foo=bar"></input>', {
    colors: false,
    html: true,
    fewerQuotes: true,
    noVersion: true
  })
  t.is(doc, `<html>
  <body>
    <input disabled placeholder='foo=bar' type=text>
  </body>
</html>\n`)
})

test('small spaces', t => {
  let doc = Dentin.dentToString('<foo><bar/></foo>', {
    colors: false,
    spaces: 0,
    noVersion: true
  })
  t.is(doc, `<foo>
<bar/>
</foo>\n`)

  doc = Dentin.dentToString(`<foo>
    <bar>aaaaa\ \
bbbbb
    ccccc\
    ddddd
\teeeee fffff</bar>
</foo>\n`, {
    colors: false,
    spaces: -1,
    margin: 15,
    noVersion: true
  })
  t.is(doc, '<foo><bar>aaaaa bbbbb ccccc ddddd eeeee fffff</bar></foo>')
})

test('PI', t => {
  let doc = Dentin.dentToString('<?boo?><foo><?huh hah?></foo><?yep?>', {
    colors: false,
    noVersion: true
  })
  t.is(doc, `<?boo?>
<foo>
  <?huh hah?>
</foo>
<?yep?>\n`)

  // make sure we don't add a leading newline for this comment
  doc = Dentin.dentToString('<!-- cmt --><foo/>', {
    colors: false,
    noVersion: true
  })
  t.is(doc, '<!-- cmt -->\n<foo/>\n')
})

test('DTD', t => {
  // short doctypes on one line
  const doc = Dentin.dentToString(`<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test PUBLIC
  'stuff'
  'things'>
<test/>`, {
    colors: false
  })
  t.is(doc, `<?xml version='1.0'?>
<!DOCTYPE test PUBLIC 'stuff' 'things'>
<test/>\n`)
})
