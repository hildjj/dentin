import {StringWidth} from '@cto.af/string-width';
import {extract} from './utils.js';

class State {
  str = '';
  total = 0;
  right = 0;
  lines = 0;
  firstLineLen = -Infinity;
  spaces = 2;

  /** @type {import('./dentin.js').Dentin} */
  dentin;
  #sw = new StringWidth();

  /**
   * @param {import('./dentin.js').Dentin} dentin
   * @param {import('./dentin.js').DentinOptions} [opts]
   */
  constructor(dentin, opts = {}) {
    Object.assign(this, {
      dentin,
      spaces: dentin.opts.spaces, // Make a copy so we can modify
    }, extract(opts, ['total', 'right', 'lines', 'spaces', 'str']));
  }

  width(str) {
    return this.#sw.width(str);
  }

  out(strOrState, length) {
    if (typeof strOrState === 'string') {
      this.str += strOrState;
      // Grapheme cluster width in cells, if not specified.
      length ??= this.#sw.width(strOrState);
      this.total += length;
      this.right += length;
    } else {
      this.str += strOrState.str;
      this.total += strOrState.total;
      this.lines += strOrState.lines;
      if (strOrState.right === -Infinity) {
        this.right += strOrState.total;
      } else {
        this.right = strOrState.right;
      }
    }
    return this;
  }

  newline() {
    if (this.spaces >= 0) {
      if (this.firstLineLen === -Infinity) {
        this.firstLineLen = this.right;
      }
      this.str = this.str.trimEnd();
      this.out('\n');
      this.right = 0;
      this.lines++;
    }
    return this;
  }

  color(bits, ...bobs) {
    // Never put newlines in color`` statements
    const withColor = Function.call.call(
      this.dentin.chalk,
      null,
      bits,
      ...bobs
    );
    const noColor = Function.call.call(
      this.dentin.noChalk,
      null,
      bits,
      ...bobs
    );
    return this.out(withColor, this.#sw.width(noColor));
  }

  newColor(bits, ...bobs) {
    const s = new State(this.dentin, {
      right: -Infinity,
    });
    return s.color(bits, ...bobs);
  }

  spacesString(n) {
    return this.out(''.padEnd(n, ' '));
  }

  spacesState(n) {
    const s = new State(this.dentin);
    return s.out(''.padEnd(n, ' '));
  }

  indent(stops) {
    return this.spacesString(this.spaces * stops);
  }

  indentState(stops) {
    return this.spacesState(this.spaces * stops);
  }
}

export default State;
