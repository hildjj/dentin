(function() {
  var DEFAULT_CONFIG, Denter, ESCAPES, QUOTE, SPACES, assert, attr_cmp, capture, collect, dent, error, escape, escape_attr, fs, ns_cmp, pi, spaces, ww, xmljs,
    slice = [].slice,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  try {
    require('source-map-support').install();
  } catch (error) {

  }

  fs = require('fs');

  assert = require('assert');

  xmljs = require('libxmljs');

  ww = require('word-wrap');

  DEFAULT_CONFIG = "./.dentin.json";

  ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
    "\xA0": '&nbsp;'
  };

  QUOTE = "'";

  SPACES = new Array(256).join(' ');

  spaces = function(n) {
    return SPACES.substring(0, n);
  };

  escape = function(str) {
    return str.replace(/[&<>\xA0]/g, function(m) {
      return ESCAPES[m];
    });
  };

  escape_attr = function(str) {
    return str.replace(/[&<>"'\xA0]/g, function(m) {
      return ESCAPES[m];
    });
  };

  attr_cmp = function(a, b) {
    var ap, bp, ref, ref1, res;
    ap = (ref = a.namespace()) != null ? ref.prefix() : void 0;
    bp = (ref1 = b.namespace()) != null ? ref1.prefix() : void 0;
    res = 0;
    if (ap != null) {
      if (bp == null) {
        res = 1;
      } else {
        res = ap.localeCompare(bp, 'en');
      }
    } else if (bp != null) {
      res = -1;
    }
    if (res === 0) {
      res = a.name().localeCompare(b.name(), 'en');
    }
    return res;
  };

  ns_cmp = function(a, b) {
    var ap, bp, res;
    ap = a.prefix();
    bp = b.prefix();
    res = 0;
    if (ap != null) {
      if (bp == null) {
        res = 1;
      } else {
        res = ap.localeCompare(bp, 'en');
      }
    }
    return res;
  };

  capture = function() {
    var f;
    f = function() {
      var j, len1, results, t, texts;
      texts = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      results = [];
      for (j = 0, len1 = texts.length; j < len1; j++) {
        t = texts[j];
        results.push(f.result += t);
      }
      return results;
    };
    f.result = "";
    return f;
  };

  Denter = (function() {
    function Denter(opts) {
      var ref, ref1, ref2, ref3, ref4;
      assert(opts != null);
      this.html = (ref = opts.html) != null ? ref : false;
      this.noversion = (ref1 = opts.noversion) != null ? ref1 : false;
      this.right_margin = (ref2 = opts.margin) != null ? ref2 : 70;
      this.indent_spaces = (ref3 = opts.spaces) != null ? ref3 : 2;
      this.ignore = (ref4 = opts.ignore) != null ? ref4 : [];
      this.file = null;
      if (typeof opts.output === "function") {
        this.out = opts.output;
      } else if (typeof opts.output === "string") {
        this.file = fs.openSync(opts.output, 'w');
        this.out = fs.writeSync.bind(fs, this.file);
      } else {
        this.out = process.stdout.write.bind(process.stdout);
      }
    }

    Denter.prototype._el_kind = function(el) {
      var c, children, j, kind, len1, ns, ntext, ref;
      children = el.childNodes();
      ns = el.namespace();
      kind = {
        text: false,
        elements: false,
        mixed: false,
        nonempty: false,
        number: children.length,
        "void": false,
        name: (ns != null) && (ns.prefix() != null) ? ns.prefix() + ":" + el.name() : el.name()
      };
      if (this.html) {
        kind["void"] = (ref = kind.name) === 'area' || ref === 'base' || ref === 'br' || ref === 'col' || ref === 'command' || ref === 'embed' || ref === 'hr' || ref === 'img' || ref === 'input' || ref === 'keygen' || ref === 'link' || ref === 'meta' || ref === 'param' || ref === 'source' || ref === 'track' || ref === 'wbr';
        if (kind["void"]) {
          if (children.length > 0) {
            console.error(("Void element '" + kind.name + "' ") + ("with children at line " + (el.line())));
          }
        }
      }
      for (j = 0, len1 = children.length; j < len1; j++) {
        c = children[j];
        switch (c.type()) {
          case 'cdata':
            kind.text = true;
            break;
          case 'element':
            kind.elements = true;
            break;
          case 'text':
            kind.text = true;
            ntext = c.text().replace(/\xA0/g, "&nbsp;");
            if (!ntext.match(/^\s*$/)) {
              kind.nonempty = true;
            }
            break;
          case 'comment':
            kind.elements = true;
            break;
          case 'entity_ref':
            kind.nonempty = true;
            break;
          default:
            console.error("unknown node type: " + (c.type()));
        }
      }
      kind.mixed = kind.elements && kind.nonempty;
      return kind;
    };

    Denter.prototype._print_pi = function(node, out, indent) {
      if (!this.noversion || (typeof parent_kind !== "undefined" && parent_kind !== null) || (node.prevSibling() != null)) {
        out("\n");
      }
      out(spaces(this.indent_spaces * indent));
      return out("<?" + (node.name()) + " " + (node.text()) + "?>");
    };

    Denter.prototype._print_dtd = function(node, out, indent) {
      var t;
      t = node.toString();
      if (t) {
        if (!this.noversion || (typeof parent_kind !== "undefined" && parent_kind !== null) || (node.prevSibling() != null)) {
          out("\n");
        }
        out(spaces(this.indent_spaces * indent));
        return out(t);
      }
    };

    Denter.prototype._print_element = function(node, out, parent_kind, indent) {
      var a, attrs, c, decls, first, i, j, k, kind, l, len1, len2, len3, len4, new_indent, o, ref, ref1, rm, tot;
      kind = this._el_kind(node);
      kind.mixed = kind.mixed || (parent_kind != null ? parent_kind.mixed : void 0);
      if (!(parent_kind != null ? parent_kind.mixed : void 0)) {
        if (!this.noversion || (parent_kind != null)) {
          out("\n");
        }
        out(spaces(this.indent_spaces * indent));
      }
      out("<" + kind.name);
      attrs = node.attrs().sort(attr_cmp).map((function(_this) {
        return function(a) {
          var name, ns, val;
          ns = a.namespace();
          name = ns != null ? " " + (ns.prefix()) + ":" + (a.name()) : " " + (a.name());
          val = a.value();
          if (_this.html && !val) {
            return name;
          } else {
            return name + "=" + QUOTE + (escape_attr(a.value())) + QUOTE;
          }
        };
      })(this));
      decls = node.namespaces(true).sort(ns_cmp).map(function(ns) {
        var p;
        p = ns.prefix();
        if (p != null) {
          return " xmlns:" + p + "=" + QUOTE + (ns.href()) + QUOTE;
        } else {
          return " xmlns=" + QUOTE + (ns.href()) + QUOTE;
        }
      });
      attrs = attrs.concat(decls);
      first = this.indent_spaces * indent + kind.name.length + 1;
      tot = attrs.reduce(function(p, a) {
        return p + a.length;
      }, first);
      if ((this.right_margin > 0) && (tot > this.right_margin)) {
        for (i = j = 0, len1 = attrs.length; j < len1; i = ++j) {
          a = attrs[i];
          if (i > 0) {
            out("\n");
            out(spaces(first));
          }
          out(a);
          kind.right_pos = first + attrs[attrs.length - 1].length + 1;
        }
      } else {
        kind.right_pos = first + 1;
        for (k = 0, len2 = attrs.length; k < len2; k++) {
          a = attrs[k];
          out(a);
          kind.right_pos += a.length;
        }
      }
      if (kind.text || kind.elements) {
        out(">");
        new_indent = indent + 1;
        if (kind.mixed) {
          rm = this.right_margin;
          this.right_margin = -1;
          ref = node.childNodes();
          for (l = 0, len3 = ref.length; l < len3; l++) {
            c = ref[l];
            this._print(c, out, kind, 0);
          }
          this.right_margin = rm;
        } else {
          ref1 = node.childNodes();
          for (o = 0, len4 = ref1.length; o < len4; o++) {
            c = ref1[o];
            this._print(c, out, kind, new_indent);
          }
        }
        if (kind.elements && !kind.nonempty && !(parent_kind != null ? parent_kind.mixed : void 0)) {
          out("\n" + (spaces(this.indent_spaces * indent)));
        }
        return out("</" + kind.name + ">");
      } else {
        if (kind["void"]) {
          return out(">");
        } else {
          if (this.html) {
            return out("></" + kind.name + ">");
          } else {
            return out("/>");
          }
        }
      }
    };

    Denter.prototype._print_text = function(node, out, parent_kind, indent) {
      var len, t, ttl;
      t = escape(node.text());
      ttl = t.trim().length;
      if (!parent_kind.elements || ttl > 0) {
        t = t.replace(/([^.])\s+/g, "$1 ");
        t = t.replace(/[.]\n\s*(?!$)/g, ".  ");
        if (parent_kind.mixed) {
          if (node.prevSibling() == null) {
            t = t.trimLeft();
          }
          if (node.nextSibling() == null) {
            t = t.trimRight();
          }
        } else {
          t = t.trim();
        }
        ttl = t.length;
        len = ttl + parent_kind.right_pos + parent_kind.name.length + 3;
        if ((this.right_margin > 0) && (len > this.right_margin)) {
          out("\n");
          t = ww(t.trim(), {
            width: this.right_margin - (this.indent_spaces * indent),
            indent: spaces(this.indent_spaces * indent),
            trim: true
          });
          out(t);
          out("\n");
          return out(spaces(this.indent_spaces * (indent - 1)));
        } else {
          return out(t);
        }
      }
    };

    Denter.prototype._print = function(node, out, parent_kind, indent) {
      var ref;
      if (parent_kind == null) {
        parent_kind = null;
      }
      if (indent == null) {
        indent = 0;
      }
      switch (node.type()) {
        case 'element':
          return this._print_element(node, out, parent_kind, indent);
        case 'text':
          if ((ref = parent_kind.name, indexOf.call(this.ignore, ref) >= 0)) {
            return out(escape(node.text()));
          } else {
            return this._print_text(node, out, parent_kind, indent);
          }
          break;
        case 'cdata':
          return out("<![CDATA[" + (node.text()) + "]]>");
        case 'comment':
          if (!this.noversion || (parent_kind != null) || (node.prevSibling() != null)) {
            out("\n");
          }
          out(spaces(this.indent_spaces * indent));
          return out("<!-- " + (node.text().trim()) + " -->");
        case 'entity_ref':
          return out("&" + (node.name()) + ";");
        case 'pi':
          return this._print_pi(node, out, indent);
        case 'dtd':
          return this._print_dtd(node, out, indent);
        default:
          return console.error("Unknown node print: " + (node.type()));
      }
    };

    Denter.prototype.print_doc = function(doc) {
      var dtd, firster, node;
      if (!this.noversion) {
        if (this.html) {
          dtd = doc.getDtd();
          if (dtd != null) {
            this.out("<!DOCTYPE " + dtd.name);
            if (dtd.externalId != null) {
              this.out(" PUBLIC " + QUOTE + dtd.externalId + QUOTE);
            }
            if (dtd.systemId != null) {
              this.out(" " + QUOTE + dtd.systemId + QUOTE);
            }
            this.out(">");
          }
        } else {
          this.out("<?xml version=" + QUOTE + (doc.version()) + QUOTE + "?>");
        }
      }
      node = doc.root();
      firster = node;
      while (firster) {
        node = firster;
        firster = node.prevSibling();
      }
      while (node) {
        this._print(node, this.out);
        node = node.nextSibling();
      }
      this.out("\n");
      if (this.file != null) {
        return fs.close(this.file);
      }
    };

    return Denter;

  })();

  this.dent = dent = function(xml, opts) {
    var doc;
    if (opts == null) {
      opts = {};
    }
    if (opts.doublequote) {
      QUOTE = '"';
    }
    doc = (function() {
      switch (false) {
        case typeof xml !== 'string':
        case !Buffer.isBuffer(xml):
          if (opts != null ? opts.html : void 0) {
            return xmljs.parseHtml(xml);
          } else {
            return xmljs.parseXml(xml);
          }
          break;
        case !(xml instanceof xmljs.Document):
          return xml;
        default:
          throw new Error('invalid argument (xml)');
      }
    })();
    return new Denter(opts).print_doc(doc);
  };

  this.dentToString = function(xml, opts) {
    var collect, out;
    if (opts == null) {
      opts = {};
    }
    out = "";
    collect = function() {
      var a, all, j, len1, results;
      all = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      results = [];
      for (j = 0, len1 = all.length; j < len1; j++) {
        a = all[j];
        results.push(out += a);
      }
      return results;
    };
    opts.output = collect;
    dent(xml, opts);
    return out;
  };

  this.dentFile = function(file_name, opts, cb) {
    if (file_name === '-') {
      file_name = '/dev/stdin';
    }
    return fs.readFile(file_name, (function(_this) {
      return function(err, data) {
        if (err != null) {
          return cb(err);
        }
        return cb(null, _this.dent(data, opts));
      };
    })(this));
  };

  collect = function(val, memo) {
    memo.push(val);
    return memo;
  };

  this.read_config = function(opts, cb) {
    var cfg, ref;
    cfg = (ref = opts != null ? opts.config : void 0) != null ? ref : DEFAULT_CONFIG;
    if (cfg == null) {
      return cb(null, opts);
    }
    return fs.exists(cfg, function(exists) {
      if (!exists) {
        return cb(null, opts);
      }
      return fs.readFile(cfg, function(err, data) {
        var config, er, error1;
        if (err != null) {
          return cb(err);
        }
        try {
          config = JSON.parse(data);
          opts.ignore = opts.ignore.concat(config.ignore);
          opts.spaces = config.spaces || opts.spaces;
          opts.margin = config.margin || opts.margin;
          opts.html = !!config.html || opts.html;
          opts.noversion = !!config.noversion || opts.noversion;
          return cb(null, opts);
        } catch (error1) {
          er = error1;
          return cb(er);
        }
      });
    });
  };

  pi = function(n) {
    return parseInt(n);
  };

  this.cmd = function(args, cb) {
    var commander, pkg, program;
    commander = require('commander');
    pkg = require('../package');
    program = new commander.Command;
    program.version(pkg.version).option('-i, --ignore <name>', 'Ignore elements with name for wrapping []', collect, []).option('-o, --output <file>', 'Output file name [stdout]').option('-c, --config <file>', "Config file to read [" + DEFAULT_CONFIG + "]", DEFAULT_CONFIG).option('-d, --doublequote', 'Use double quotes for attributes [false]', false).option('-m, --margin <int>', 'Right margin in spaces [78]', pi, 78).option('-s, --spaces <int>', 'Number of spaces to indent [2]', pi, 2).option('-n, --noversion', 'Don\'t output xml version prefix [false]').option('--html', 'Parse and generate HTML instead of XML [look at filename]').usage('[options] [file...]').parse(args);
    if (program.args.length === 0) {
      program.args.push('-');
    }
    if ((program.html == null) && program.args[0].match(/.html?$/)) {
      program.html = true;
    }
    return this.read_config(program, (function(_this) {
      return function(er) {
        var d, j, len1, ref;
        if (er != null) {
          return process.stderr.write(program.config + ": " + er.message + "\n");
        }
        ref = program.args;
        for (j = 0, len1 = ref.length; j < len1; j++) {
          d = ref[j];
          _this.dentFile(d, program, function(er, output) {});
          if (er != null) {
            return cb(er);
          }
          cb(null);
        }
      };
    })(this));
  };

}).call(this);

//# sourceMappingURL=dentin.js.map
