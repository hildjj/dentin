'use strict'

const {extract} = require('./utils')

class State {
  constructor(dentin, opts = {}) {
    Object.assign(this, {
      dentin,
      spaces: dentin.opts.spaces, // Make a copy so we can modify
      total: 0,
      right: 0,
      lines: 0,
      firstLineLen: -Infinity,
      str: '',
    }, extract(opts, ['total', 'right', 'lines', 'spaces', 'str']))
  }

  out(strOrState, length) {
    if (typeof strOrState === 'string') {
      // TODO: return grapheme cluster length
      this.str += strOrState
      const len = (length == null) ? strOrState.length : length
      this.total += len
      this.right += len
    } else {
      this.str += strOrState.str
      this.total += strOrState.total
      this.lines += strOrState.lines
      if (strOrState.right === -Infinity) {
        this.right += strOrState.total
      } else {
        this.right = strOrState.right
      }
    }
    return this
  }

  newline() {
    if (this.spaces >= 0) {
      if (this.firstLineLen === -Infinity) {
        this.firstLineLen = this.right
      }
      this.out('\n')
      this.right = 0
      this.lines++
    }
    return this
  }

  color(bits, ...bobs) {
    // Never put newlines in color`` statements
    const withColor = Function.call.call(
      this.dentin.chalk,
      null,
      bits,
      ...bobs
    )
    const noColor = Function.call.call(
      this.dentin.noChalk,
      null,
      bits,
      ...bobs
    )
    return this.out(withColor, noColor.length)
  }

  newColor(bits, ...bobs) {
    const s = new State(this.dentin, {
      right: -Infinity,
    })
    return s.color(bits, ...bobs)
  }

  spacesString(n) {
    return this.out(''.padEnd(n, ' '))
  }

  spacesState(n) {
    const s = new State(this.dentin)
    return s.out(''.padEnd(n, ' '))
  }

  indent(stops) {
    return this.spacesString(this.spaces * stops)
  }

  indentState(stops) {
    return this.spacesState(this.spaces * stops)
  }
}

module.exports = State
