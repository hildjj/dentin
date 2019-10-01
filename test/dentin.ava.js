'use strict'

const fs = require('fs').promises
const path = require('path')
const stream = require('stream')
const test = require('ava')
const libxmljs = require('libxmljs')
const Dentin = require('../lib/dentin')

test('dentToString', t => {
  const out = Dentin.dentToString(
    '<foo xmlns:foo="urn:foo" y="n&apos;&amp;>"><foo:bar foo:x="y"/></foo>')
  t.deepEqual(out, `<?xml version='1.0'?>
<foo y='n&apos;&amp;&gt;' xmlns:foo='urn:foo'>
  <foo:bar foo:x='y'/>
</foo>\n`)
})

test('constructor', t => {
  const d = new Dentin()
  t.deepEqual(d.opts, {
    html: false,
    noVersion: false,
    margin: 70,
    indentSpaces: 2,
    doubleQuote: false,
    ignore: [],
    output: null
  })
  t.is(d.quote, '\'')
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
    b:b='bbb'/>`)
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
    a='aa'/>`, {noVersion: true, doubleQuote: true})
  t.is(doc,
    '<foo a="aa" b="bb" xmlns="urn:a" xmlns:b="urn:b" xmlns:c="urn:c"/>\n')
})
test('examples', async t => {
  const dn = path.join(__dirname, '..', 'examples')
  const dir = await fs.readdir(dn)
  t.truthy(dir.length > 0)
  for (const fx of dir.filter(f => f.endsWith('.xml'))) {
    const input = await fs.readFile(path.join(dn, fx))
    const output = await fs.readFile(path.join(dn, fx + '.out'), 'utf8')
    const s = Dentin.dentToString(input, {
      ignore: [
        'artwork',
        'sourcecode'
      ],
      margin: 78
    })
    t.is(s, output, fx)
  }
  for (const fh of dir.filter(f => f.endsWith('.html'))) {
    const output = await fs.readFile(path.join(dn, fh + '.out'), 'utf8')
    const out = []
    await Dentin.dentFile(path.join(dn, fh), {
      margin: 78,
      output: new stream.Writable({
        decodeStrings: false,
        write(buf, enc, cb) {
          out.push(buf)
          cb()
          return true
        }
      })
    })
    t.is(out.join(''), output, fh)
  }
})
test('errors', t => {
  // force a malformed HTML text; the parser doesn't generate these.
  const doc = libxmljs.parseHtml('<br>')
  const br = doc.get('body/br')
  br.addChild(new libxmljs.Element(doc, 'p', 'text'))
  t.throws(() => {
    return Dentin.dent(doc, {
      html: true,
      noVersion: true,
      output: new stream.Writable({
        decodeStrings: false,
        write(buf, enc, cb) {
          cb()
          return true
        }
      })
    })
  })
  t.throws(() => {
    Dentin.dent(true)
  })
})
