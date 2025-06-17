'use strict';

const test = require('ava');
const xml = require('libxmljs2');
const Wrapper = require('../lib/wrapper');
const Dentin = require('../lib/dentin');

test('Create', t => {
  t.throws(() => new Wrapper()); // Dentin required
  const k = new Wrapper(new Dentin());
  t.truthy(k);
  t.is(typeof k, 'object');
  t.is(k.node, null);
  t.is(k.parentWrapper, null);
});

test('Comment', t => {
  const doc = xml.parseXml('<f><!-- hi  \t  there --></f>');
  const [comment] = doc.childNodes();
  t.is(comment.type(), 'comment');
  const d = new Dentin({colors: false});
  const k = Wrapper.create(d, comment);
  t.truthy(k);
  t.is(k.type, 'comment');
  t.is(k.comment, true);
  t.deepEqual(k.print().str, '<!-- hi there -->\n');
});

test('Decl', t => {
  const doc = xml.parseXml(`<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY js "EcmaScript">
]>
<foo>&js;</foo>`);
  const dk = Wrapper.create(new Dentin({colors: false}), doc);
  const [ek] = dk.children[0].children;
  t.is(ek.type, 'entity_decl');
  const eek = Wrapper.create(dk.dentin, ek.node);
  ek.parentWrapper = null;
  t.deepEqual(ek, eek);
  t.is(eek.print().str, '<!ENTITY js \'EcmaScript\'>\n');
});

test('Attribute', t => {
  const doc = xml.parseXml('<f a="b"/>');
  const root = doc.root();
  const [a] = root.attrs();
  const k = Wrapper.create(new Dentin({colors: false}), a);
  t.is(k.type, 'attribute');
  const str = ' a=\'b\'';
  t.deepEqual(k.print().str, str);
  // TODO: Figure this out later
  // k = Wrapper.create(new Dentin(), a)
  // t.not(k.print().str, str) // colors make it different
});

test('Namespace', t => {
  const doc = xml.parseXml('<f xmlns="urn:foo" xmlns:b="urn:bar"/>');
  const root = doc.root();
  const d = new Dentin({doubleQuote: true, colors: false});
  const nsk = root.namespaces(true).map(ns => Wrapper.create(d, ns));
  const expected = [
    ' xmlns="urn:foo"',
    ' xmlns:b="urn:bar"',
  ];
  for (const k of nsk) {
    t.is(k.type, 'namespace');
    const str = expected.shift();
    t.deepEqual(k.print().str, str);
  }
});

test('DTD', t => {
  let doc = xml.parseXml(`<!DOCTYPE html PUBLIC
  '-//W3C//DTD HTML 4.0 Transitional//EN'
  'http://www.w3.org/TR/REC-html40/loose.dtd'>
<html></html>`);
  const d = new Dentin({doubleQuote: true, colors: false});
  let k = Wrapper.create(d, doc.root().prevSibling());
  t.deepEqual(k.print().str, `<!DOCTYPE html PUBLIC
  "-//W3C//DTD HTML 4.0 Transitional//EN"
  "http://www.w3.org/TR/REC-html40/loose.dtd">\n`);

  doc = xml.parseXml(`<!DOCTYPE foo [
    <!ENTITY js 'EcmaScript'>
    <?not "much" 'here'?>
    ]><f/>`);
  k = Wrapper.create(d, doc.root().prevSibling());
  t.deepEqual(k.print().str, `<!DOCTYPE foo [
  <!ENTITY js "EcmaScript">
  <?not "much" "here"?>
]>\n`);

  doc = xml.parseXml(`<!DOCTYPE foo
    SYSTEM 'http://www.w3.org/TR/REC-html40/loose.dtd'><f/>`);
  k = Wrapper.create(d, doc.root().prevSibling());
  t.deepEqual(k.print().str,
    '<!DOCTYPE foo SYSTEM "http://www.w3.org/TR/REC-html40/loose.dtd">\n');
});

test('Element', t => {
  const doc = xml.parseXml(`<foo><b/><c>
  <d b:foo='bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa'
     xmlns='urn:d' xmlns:b='urn:b'/>
</c></foo>`);
  const d = new Dentin({doubleQuote: true, colors: false});
  const k = Wrapper.create(d, doc.root());
  t.deepEqual(k.print().str, `<foo>
  <b/>
  <c>
    <d b:foo="bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa"
       xmlns="urn:d"
       xmlns:b="urn:b"/>
  </c>
</foo>\n`);
});

test('Text', t => {
  const doc = xml.parseXml(`<foo>
  <d>bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa</d>
</foo>`);
  const d = new Dentin({doubleQuote: true, colors: false});
  const k = Wrapper.create(d, doc.get('d/text()'));
  t.deepEqual(k.print().str,
    'bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa');
});

test('CDATA', t => {
  const doc = xml.parseXml(`<foo>
  <![CDATA[ bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa ]]>
</foo>`);
  const d = new Dentin({doubleQuote: true, colors: false});
  const k = Wrapper.create(d, doc.root().childNodes()[1]);
  t.deepEqual(k.print().str,
    '<![CDATA[ bahbaaaaaaaahhhhhloooooooohaaaaaaahaaaa ]]>');
});

test('Processing Instruction', t => {
  let doc = xml.parseXml('<foo><baz/><?bar?> boo</foo>');
  const d = new Dentin({colors: false});
  const [, k] = Wrapper.create(d, doc.root()).children;
  t.truthy(k.parentMixed());
  t.deepEqual(k.print().str, '\n<?bar?>\n');
  doc = xml.parseXml('<foo>   <?bar?> boo</foo>');
  const [, p] = Wrapper.create(d, doc.root()).children;
  t.truthy(p.parentMixed());
  t.deepEqual(p.print().str, '<?bar?>\n');
});
