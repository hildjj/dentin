'use strict'

const {Writable} = require('stream')

class StringWriter extends Writable {
  constructor(opts = {}) {
    opts.decodeString = false
    super(opts)
    this.out = []
  }
  _write(chunk, encoding, cb) {
    this.out.push(chunk)
    cb()
  }
  read() {
    // TODO: It is said that += is faster than Array.prototype.join.  Benchmark.
    const ret = this.out.join('')
    this.out = []
    return ret
  }
}

exports.StringWriter = StringWriter
