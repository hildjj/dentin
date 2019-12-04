'use strict'

const Dentin = require('./dentin')
const State = require('./state')
const {setChalkTheme} = require('./utils')

const VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]

const BOOLEAN_ATTRIBUTES = [
  'allowfullscreen',
  'allowpaymentrequest',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
  'truespeed',
  'typemustmatch'
]

const SPACES = new Array(256).join(' ')

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&apos;',
  '\xA0': '&nbsp;'
}

/**
 * Escape strings inside an element
 * @param {String} str - string containing prohibited characters
 * @return {String} - escaped string
 * @private
 */
function escape(str) {
  return str.replace(/[&<>\xA0]/g, m => ESCAPES[m])
}

/**
 * Compare two libXmljs namespaces for ordering.
 *
 * @param {libxmljs.Namespace} a - first
 * @param {libxmljs.Namespace} b - second
 * @return {Number} - -1,0,1 for <=>
 * @private
 */
function nsCmp(a, b) {
  let res = 0
  if (a == null) {
    if (b != null) {
      res = -1
    }
  } else if (b == null) {
    res = 1
  } else {
    const ap = a.prefix()
    const bp = b.prefix()
    if (ap != null) {
      if ((bp == null)) {
        res = 1
      } else {
        res = ap.localeCompare(bp, 'en')
      }
    } else if (bp != null) {
      res = -1
    }
  }
  return res
}

/**
 * Abstract base class for node Wrapper.
 * A node Wrapper subclass has-a node, and carries a set of analyses about
 * the node.  Don't call the constructor directly, but call the static
 * create() funciton, which acts as a factory.
 */
class Wrapper {
  /**
   * Create
   *
   * @param {Dentin} dentin - configuration
   * @param {libxmljs.Node} [node=null] - Wrap the given node
   * @param {Wrapper} [parentWrapper=null] - the parent of this node, null for the
   *   top-level
   */
  constructor(dentin, node=null, parentWrapper=null) {
    if (dentin == null) {
      throw new TypeError('Dentin required')
    }
    Object.assign(this, {
      children: [],  // child Wrappers, one per child node
      comment: false, // is this a comment?
      dtd: false, // is this a dtd?
      element: false, // is this element-like?  PIs and comments are.
      elements: false, // does this contain at least one child element?
      mixed: false, // does this contain both an element and text?
      name: null, // node name for elements
      nonempty: false, // does this have non-empty text?
      right_pos: -Infinity, // number of graphemes right on the current line
      text: false, // is this text?
      type: null, // node type
      void: false, // HTML void node that can't contain children
      dentin,
      node,
      parentWrapper
    })
  }

  /**
   * Does the node have a parent that is mixed?
   *
   * @return {Boolean}
   */
  parentMixed() {
    return (this.parentWrapper != null) && this.parentWrapper.mixed
  }

  /**
   * Abstract.  Print the node and return information about it.
   * 
   * @param {Number} [indent=0] - how many tab stops to indent
   * @param {State} [state=null] - the current print state.  New one created
   *   if null.
   * @return {State} - final state
   */
  print(indent=0, state=new State(this.dentin)) {
    return state
  }

  /**
   * Factory method to create the right Wrapper based on the given node.
   * 
   * @param {Dentin} dentin - configuration
   * @param {libxmljs.Node} [node=null] - Wrap the given node
   * @param {Wrapper} [parentWrapper=null] - the parent of this node, null for the
   *   top-level
   * @return {Wrapper} - a new Wrapper wrapping node
   */
  static create(dentin, node, parentWrapper) {
    let WrapperKind = Wrapper // pass in null to get the abstract base
    if (node) {
      if (node.type == null) {
        if (node.href) {
          WrapperKind = NamespaceWrapper
        } else {
          // others?
          throw new Error('Unknown node Wrapper' + node.toString())
        }
      } else {
        WrapperKind = {
          attribute: AttributeWrapper,
          attribute_decl: DeclWrapper,
          cdata: CdataWrapper,
          comment: CommentWrapper,
          document: DocumentWrapper,
          dtd: DtdWrapper,
          element: ElementWrapper,
          element_decl: DeclWrapper,
          entity_decl: DeclWrapper,
          entity_ref: RefWrapper,
          pi: PiWrapper,
          text: TextWrapper
        }[node.type()]
      }
    }
    return new WrapperKind(dentin, node, parentWrapper)
  }
}

/**
 * Element attribute
 */
class AttributeWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    const oname = node.name()
    let name = oname
    if (dentin.opts.html) {
      name = name.toLowerCase()
    }
    const ns = node.namespace()
    if (ns != null) {
      name = `${ns.prefix()}:${name}`
    }
    Object.assign(this, {
      type: 'attribute',
      name,
      ns,
      oname,
      quote: dentin.quote
    })
  }

  /**
   * Attributes need to escape quotes.
   */
  escapedValue() {
    // TODO: don't escape opposite quotes?  double-check XML spec first.
    return this.node.value().replace(/[&<>"'\xA0]/g, m => ESCAPES[m])
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    const val = this.escapedValue()

    if (this.dentin.opts.html) {
      if (BOOLEAN_ATTRIBUTES.includes(this.name) || !val) {
        return state.color` {ATTRIBUTE ${this.name}}`
      }
      // must not contain any literal ASCII whitespace, any U+0022 QUOTATION
      // MARK characters ("), U+0027 APOSTROPHE characters ('), U+003D EQUALS
      // SIGN characters (=), U+003C LESS-THAN SIGN characters (<), U+003E
      // GREATER-THAN SIGN characters (>), or U+0060 GRAVE ACCENT characters
      // (`), and must not be the empty string
      if (this.dentin.opts.fewerQuotes && val.match(/^[^ \t\r\n"'=<>`]+$/)) {
        // eslint-disable-next-line max-len
        return state.color` {ATTRIBUTE ${this.name}}{PUNCTUATION =}{ATTRIBUTE_VALUE ${val}}`
      }
    }
    // eslint-disable-next-line max-len
    return state.color` {ATTRIBUTE ${this.name}}{PUNCTUATION =${this.quote}}{ATTRIBUTE_VALUE ${val}}{PUNCTUATION ${this.quote}}`
  }

  /**
   * Compare attributes for sorting.  Sort by namespace first, then by
   * localname.
   */
  static compare(a, b) {
    const res = nsCmp(a.ns, b.ns)
    if (res === 0) {
      return a.oname.localeCompare(b.oname, 'en')
    }
    return res
  }
}

/**
 * CDATA section.  No indentation.
 */
class CdataWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'cdata',
      text: true,
      nonempty: true
    })
  }

  print(indent = 0, state) {
    state = super.print(indent, state)
    const text = this.node.text()
    // eslint-disable-next-line max-len
    return state.color`{PUNCTUATION <![}{ELEMENT CDATA}{PUNCTUATION [}${text}{PUNCTUATION ]]>}`
  }
}

/**
 * Normal flowing text inside an element.  Lots of word-wrapping.
 */
class TextWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'text',
      text: true
    })
    const ntext = node.text().replace(/\xA0/g, '&nbsp;')
    if (!ntext.match(/^\s*$/)) {
      this.nonempty = true
    }
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    if (!this.nonempty) {
      return 0
    }

    let t = this.node.text()
    if (!this.comment) {
      t = escape(t)
    }

    // Parent element name is ignored
    // TODO: Read and understand xml:space
    if ((this.parentWrapper != null) &&
        this.dentin.opts.ignore.includes(this.parentWrapper.name))  {
      return state.color`{TEXT ${t}}`
    }
    const parentMixed = this.parentMixed()

    // Collapse all whitespace
    t = t.replace(/\s+/g, ' ')

    // if the parent is mixed, only trim at the beginning or end, as needed
    if (parentMixed && !this.comment) {
      if ((this.node.prevSibling() == null)) {
        t = t.trimLeft()
      }
      if ((this.node.nextSibling() == null)) {
        t = t.trimRight()
      }
    } else {
      t = t.trim()
    }

    const strict = state.spaces < 0
    const ttl = t.length
    let left = state.right
    let right = (this.parentWrapper == null) ?
      0 :
      this.parentWrapper.name.length + 3 // </name>

    // we're going to add '<!-- ' and ' -->'.
    if (this.comment) {
      left += 5
      right += 4
    }
    // no sense word-wrapping if we're not going to use newlines.
    // There are a few ways left could be positive with spaces < 0.
    if (strict ||
        (left + ttl + right <= this.dentin.opts.margin)) {
      // it fits
      if (this.comment) {
        return state.color` {TEXT ${t}} `
      } else {
        return state.color`{TEXT ${t}}`
      }
    } else {
      // it doesn't fit.  let's have a newline before and after if we're not
      // mixed, then word-wrap indented
      if (!parentMixed) {
        state.newline()
        state.indent(indent)
      }
      let lastLine = state.right
      let outText = ''
      let first = true
      // hold on to trailing whitespace now, to re-add it later.
      const trail = (t[t.length - 1] === ' ') ? ' ' : ''

      for (let chunk of t.split(/(\S+\s+)/)) {
        if (chunk.length === 0) {
          continue
        }
        if (chunk.match(/^[^\.]+\. $/)) {
          // spaces after a period.  Already has one.
          chunk += state.spacesState(this.dentin.opts.periodSpaces - 1).str
        }
        // if this is the first chunk, always use it, because it might be too
        // long, and an extra newline/indent won't help.  Later long chunks
        // should always get their own line.
        if (!first) {
          const trimChunk = chunk.trimRight()
          if (lastLine + trimChunk.length > this.dentin.opts.margin) {
            outText += '\n'
            state.lines++
            const ind = state.indentState(indent)
            outText += ind.str
            lastLine = ind.total
          }
        }
        lastLine += chunk.length
        outText += chunk
        first = false
      }
      // might have left trailing spaces above.  Will remove a trailing
      // newline also
      outText = outText.replace(/\s+$/gm, '')
      outText += trail
      state.color`{TEXT ${outText}}`
      if (!parentMixed) {
        state.newline()
        state.indent(indent - 1)
      } else {
        state.right = lastLine
      }

      return state
    }
  }
}

class CommentWrapper extends TextWrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      comment: true,
      element: true,
      text: false,
      type: 'comment'
    })
  }

  print(indent=0, state=new State(this.dentin)) {
    const parentMixed = this.parentMixed()

    if (!parentMixed) {
      state.indent(indent)
    }
    state.color`{PUNCTUATION <!--}`
    super.print(indent + 1, state)
    state.color`{PUNCTUATION -->}`

    if (!parentMixed) {
      state.newline()
    }
    return state
  }
}

class DocumentWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'document',
      name: '',
      quote: dentin.quote
    })

    // libxmljs doesn't allow you to get all of the child nodes of the document,
    // just the root node.  Examples: comments, PI's, etc.
    // Surf to the front, then go back forward
    let n = node.root()
    let firster = n
    while (firster) {
      n = firster
      firster = n.prevSibling()
    }
    while (n) {
      this.children.push(Wrapper.create(dentin, n, this))
      n = n.nextSibling()
    }
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    if (!this.dentin.opts.noVersion) {
      if (!this.dentin.opts.html) {
        // eslint-disable-next-line max-len
        state.color`{PUNCTUATION <?}{ELEMENT xml} {ATTRIBUTE version}{PUNCTUATION =}{PUNCTUATION ${this.quote}}{ATTRIBUTE_VALUE ${this.node.version()}}{PUNCTUATION ${this.quote}}?>`
        state.newline()
      }
    }
    for (const c of this.children) {
      c.print(indent, state)
    }
    return state
  }
}

/**
 * attribute_decl, element_decl, entity_decl
 */
class DeclWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    this.type = node.type()
    this.quote = dentin.quote
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    state.indent(indent)
    let decl = this.node.toString()
    const startLen = decl.length
    // mess with the colorization, but don't change anything else.
    decl = decl.replace(/^<!+(\S+)\s+%\s+(\S+)/,
      // eslint-disable-next-line max-len
      this.dentin.chalk`{PUNCTUATION <!}{ELEMENT $1} {PUNCTUATION %} {ATTRIBUTE $2}`)
    decl = decl.replace(/^<!+(\S+)\s+(\S+)/,
      this.dentin.chalk`{PUNCTUATION <!}{ELEMENT $1} {ATTRIBUTE $2}`)
    decl = decl.replace(/"([^"]*)"/g,
      this.dentin.chalk`${this.quote}{ATTRIBUTE_VALUE $1}${this.quote}`)
    decl = decl.replace(/>\n/, this.dentin.chalk`{PUNCTUATION >}`)
    state.out(decl, startLen)
    state.newline()
    return state
  }
}

class DtdWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      children: node.childNodes().map(c => Wrapper.create(dentin, c, this)),
      name: '',
      type: 'dtd',
      quote: dentin.quote
    })
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    if (this.dentin.opts.html &&
        this.dentin.opts.noVersion &&
        (this.children.length === 0)) {
      // handle this elsewhere?
      return state
    }

    state.indent(indent)
    const {name, externalId, systemId} = this.node.doc().getDtd()

    // <!DOCTYPE foo
    state.color`{PUNCTUATION <!}{ELEMENT DOCTYPE} {ATTRIBUTE ${name}}`
    let first = state.right

    // if externalId, always systemId, and we're PUBLIC
    // otherwise if systemId, we're SYSTEM
    const ext = externalId ?
      state.newColor`{PUNCTUATION ${this.quote}}{ATTRIBUTE_VALUE ${externalId}}{PUNCTUATION ${this.quote}}` : // eslint-disable-line max-len
      null
    const sys = systemId ?
      state.newColor`{PUNCTUATION ${this.quote}}{ATTRIBUTE_VALUE ${systemId}}{PUNCTUATION ${this.quote}}` : // eslint-disable-line max-len
      null

    let pubSystem = null
    if (ext) {
      pubSystem = state.newColor` {ATTRIBUTE PUBLIC}`
      first += pubSystem.total + ext.total + 1 + sys.total // 1 for the space
    } else if (sys) {
      pubSystem = state.newColor` {ATTRIBUTE SYSTEM}`
      first += pubSystem.total + sys.total
    }

    if (this.children.length == 0) {
      // the trailing >
      first++
    }
    if (first < this.dentin.opts.margin) {
      // fits on one line
      if (pubSystem) {
        state.out(pubSystem)
        if (ext) {
          state.out(' ')
          state.out(ext)
        }
        if (sys) {
          state.out(' ')
          state.out(sys)
        }
      }
    } else {
      // doesn't fit
      if (pubSystem) {
        state.out(pubSystem)
        state.newline()
        if (ext) {
          state.indent(indent + 1)
          state.out(ext)
          state.newline()
        }
        if (sys) {
          state.indent(indent + 1)
          state.out(sys)
        }
      }
    }

    if (this.children.length > 0) {
      state.color` {PUNCTUATION [}`
      state.newline()
      for (const c of this.children) {
        c.print(indent + 1, state)
      }
      state.indent(indent)
      state.color`{PUNCTUATION ]}`
    }
    state.color`{PUNCTUATION >}`
    return state.newline()
  }
}

class ElementWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    const children = node.childNodes()
    const ns = node.namespace()
    const prefix = (ns != null) ? ns.prefix() : null
    Object.assign(this, {
      type: 'element',
      element: true,
      name: (prefix != null) ? `${prefix}:${node.name()}` : node.name()
    })

    if (dentin.opts.html) {
      this.name = this.name.toLowerCase()
      this.void = VOID_ELEMENTS.includes(this.name)
      if (this.void) {
        if (children.length > 0) {
          throw new Error(`Void element '${this.name}' ` +
            `with children at line ${node.line()}`
          )
        }
      }
    }

    this.attributes = this.node.attrs()
      .map(a => new AttributeWrapper(dentin, a, this))
      .sort(AttributeWrapper.compare)

    this.namespaces = this.node.namespaces(true)
      .sort(nsCmp)
      .map(ns => new NamespaceWrapper(dentin, ns, this))

    this.children = children.map(c => {
      const k = Wrapper.create(dentin, c, this)
      if (k.text && k.nonempty) {
        this.nonempty = true
      }
      if (k.element) {
        this.elements = true
      }
      return k
    })

    // can't pre-compute parentMixed here, since the parent is not done
    // constructing
    this.mixed = this.elements && this.nonempty
  }

  print(indent=0, state) {
    state = super.print(indent, state)
    const parentMixed = this.parentMixed()
    const strict = (state.spaces < 0)

    if (!parentMixed) {
      state.indent(indent)
    }

    // <foo
    state.color`{PUNCTUATION <}{ELEMENT ${this.name}}`

    // will all the attributes and namespace declarations fit?
    const attrs = [
      // indent/right_pos ignored
      ...this.attributes.map(a => a.print(
        0, new State(state.dentin, {right: -Infinity}))),
      ...this.namespaces.map(ns => ns.print(
        0, new State(state.dentin, {right: -Infinity})))
    ]
    let first = attrs.reduce((p, {total}) => p + total, state.right)
    first += (this.children.length > 0) ? 1 : 2 // > or />
    if ((this.dentin.opts.margin > 0) &&
        (first > this.dentin.opts.margin) &&
        !parentMixed &&
        !strict) {
      // no, they don't fit
      first = state.right
      // each attribute on a new line, except first
      for (const [i, attrSL] of attrs.entries()) {
        if ((i > 0) && (state.spaces > 0)) {
          // if spaces is 0, avoid the newline.  minor nit.
          state.newline()
          state.spacesString(first)
        }
        state.out(attrSL)
      }
    } else {
      // fits
      for (const attrSL of attrs) {
        state.out(attrSL)
      }
    }

    // any children?
    if (!this.nonempty && !this.elements) {
      // no
      if (this.void) {
        state.color`{PUNCTUATION >}`
      } else {
        if (this.dentin.opts.html) {
          // in HTML, if it's not a void element, you MUST output the close tag
          state.color`{PUNCTUATION ></}{ELEMENT ${this.name}}{PUNCTUATION >}`
        } else {
          state.color`{PUNCTUATION />}`
        }
      }
    } else {
      // yes
      state.color`{PUNCTUATION >}`
      const new_right_pos = state.right

      if (this.mixed) {
        // they might all fit.
        let right = new_right_pos
        let newlines = false
        const childStates = this.children.map(c => {
          // negative spaces means don't insert newlines at all in text
          if (!newlines) {
            // exit early as soon as we wrap
            const s = new State(state.dentin, {
              spaces: -Infinity,
              right
            })
            c.print(indent, s)
            right = s.right
            if (s.lines > 0) {
              newlines = true
            }
            return s
          }
          return null
        })

        // </> -> 3
        if (!newlines &&
            (right + this.name.length + 3 < this.dentin.opts.margin)) {
          // They fit!
          for (const s of childStates) {
            state.out(s)
          }
        } else {
          // start over; childSL will have been done with the wrong assumptions
          if (!parentMixed && !strict) {
            // if parent is mixed, it will handle newlines
            state.newline()
            state.indent(indent + 1)
          }
          // render each child, then if it fits or is the first one, print it.
          let first = true
          for (const c of this.children) {
            let s = new State(state.dentin, {
              spaces: state.spaces,
              right: state.right
            })
            c.print(indent + 1, s)
            if (s.lines > 0) {
              // there were newlines in the output
              if (!first) {
                if (!strict &&
                    (state.right + s.firstLineLen > this.dentin.opts.margin)) {
                  state.newline()
                  state.indent(indent + 1)
                  if (c.element) {
                    // we've done a newline.  there's a chance that this element
                    // will fit now.  Third time is the charm.
                    s = new State(state.dentin, {
                      spaces: state.spaces,
                      right: state.right
                    })
                    c.print(indent+1, s)
                  }
                }
              }
            } else {
              if (!first) {
                if (!strict && (s.right > this.dentin.opts.margin)) {
                  state.newline()
                  state.indent(indent + 1)
                  s = new State(state.dentin, {
                    spaces: state.spaces,
                    right: state.right
                  })
                  c.print(indent + 1, s)
                }
              }
            }
            state.out(s)
            first = false
          }
          if (!parentMixed && !strict) {
            state.newline()
            state.indent(indent)
          }
        }
      } else {
        if (this.elements && !strict) {
          state.newline()
        }
        for (const c of this.children) {
          c.print(indent + 1, state)
        }
        if (this.elements && !this.nonempty && !strict) {
          state.indent(indent)
        }
      }

      state.color`{PUNCTUATION </}{ELEMENT ${this.name}}{PUNCTUATION >}`
    }
    if (!parentMixed && !strict) {
      state.newline()
    }

    return state
  }
}

class NamespaceWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'namespace',
      prefix: node.prefix(),
      href: node.href(),
      quote: dentin.quote
    })
  }

  print(indent, state) {
    state = super.print(indent, state)
    if (this.prefix != null) {
      // eslint-disable-next-line max-len
      state.color` {ATTRIBUTE xmlns:${this.prefix}}{PUNCTUATION =${this.quote}}{ATTRIBUTE_VALUE ${this.href}}{PUNCTUATION ${this.quote}}`
    } else {
      // eslint-disable-next-line max-len
      state.color` {ATTRIBUTE xmlns}{PUNCTUATION =${this.quote}}{ATTRIBUTE_VALUE ${this.href}}{PUNCTUATION ${this.quote}}`
    }
    return state
  }
}

class PiWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'pi',
      element: true,
      name: node.name(),
      quote: dentin.quote,
      textish: true
    })
  }

  print(indent=0, state) {
    // Make PI's stand out by ensuring they have their own line
    state = super.print(indent, state)

    // if parentMixed, and this isn't the first non-empty thing, we need a
    // newline.
    const parentMixed = this.parentMixed()
    if (parentMixed) {
      let n = this.node
      let first = true
      while (n) {
        n = n.prevSibling()
        if (n != null) {
          break
        }
        if (n.type() === 'text') {
          if (!n.text().match(/^\s*$/)) {
            first = false
            break
          }
        } else {
          first = false
          break
        }
      }
      if (!first) {
        state.newline()
      }
    }
    state.indent(indent)

    state.color`{PUNCTUATION <?}{ELEMENT ${this.name}}`
    let txt = this.node.text()
    const tlen = txt.length
    if (tlen > 0) {
      txt = txt.replace(/(['"])([^'"]+)\1/g, (...m) => {
        // eslint-disable-next-line max-len
        return this.dentin.chalk`{PUNCTUATION ${this.quote}}{ATTRIBUTE ${m[2]}}{PUNCTUATION ${this.quote}}`
      })
      state.out(' ')
      state.out(txt, tlen)
    }
    state.color`{PUNCTUATION ?>}`
    state.newline()

    // TODO: I bet if the parent is mixed, and this isn't the last thing,
    // we may need to indent.  But, try PI/PI/text.
    return state
  }
}

class RefWrapper extends Wrapper {
  constructor(dentin, node, parentWrapper) {
    super(dentin, node, parentWrapper)
    Object.assign(this, {
      type: 'entity_ref',
      text: true,
      nonempty: true
    })
  }
  print(indent=0, state) {
    state = super.print(indent, state)
    return state.color`{PUNCTUATION &}${this.node.name()}{PUNCTUATION ;}`
  }
}

module.exports = Wrapper
