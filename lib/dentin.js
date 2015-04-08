(function() {
  var Denter, ESCAPES, SPACES, assert, attr_cmp, capture, collect, escape, escape_attr, fs, ns_cmp, pi, read_config, spaces, ww, xmljs,
    slice = [].slice,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  fs = require('fs');

  assert = require('assert');

  xmljs = require('libxmljs');

  ww = require('word-wrap');

  ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };

  SPACES = new Array(256).join(' ');

  spaces = function(n) {
    return SPACES.substring(0, n);
  };

  escape = function(str) {
    return str.replace(/[&<>]/g, function(m) {
      return ESCAPES[m];
    });
  };

  escape_attr = function(str) {
    return str.replace(/[&<>"]/g, function(m) {
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
      var ref, ref1, ref2, ref3;
      assert(opts != null);
      this.noversion = (ref = opts.noversion) != null ? ref : false;
      this.right_margin = (ref1 = opts.margin) != null ? ref1 : 70;
      this.indent_spaces = (ref2 = opts.spaces) != null ? ref2 : 2;
      this.ignore = (ref3 = opts.ignore) != null ? ref3 : [];
    }

    Denter.prototype.el_kind = function(el) {
      var c, children, j, kind, len1, ns;
      children = el.childNodes();
      ns = el.namespace();
      kind = {
        text: false,
        elements: false,
        nonempty: false,
        number: children.length,
        name: (ns != null) && (ns.prefix() != null) ? ns.prefix() + ":" + el.name() : el.name()
      };
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
            if (!c.text().match(/^\s*$/)) {
              kind.nonempty = true;
            }
        }
      }
      kind.mixed = kind.elements && kind.nonempty;
      return kind;
    };

    Denter.prototype.print_element = function(node, out, parent_kind, indent) {
      var a, attrs, c, cap, decls, first, i, j, k, kind, l, len1, len2, len3, len4, new_indent, o, ref, ref1, ref2, tot;
      kind = this.el_kind(node);
      kind.mixed = kind.mixed || (parent_kind != null ? parent_kind.mixed : void 0);
      if (!this.noversion || (parent_kind != null)) {
        out("\n");
      }
      out(spaces(this.indent_spaces * indent));
      out("<" + kind.name);
      attrs = node.attrs().sort(attr_cmp).map(function(a) {
        var ns;
        ns = a.namespace();
        if (ns != null) {
          return " " + (ns.prefix()) + ":" + (a.name()) + "=\"" + (escape_attr(a.value())) + "\"";
        } else {
          return " " + (a.name()) + "=\"" + (escape_attr(a.value())) + "\"";
        }
      });
      decls = node.nsDecls().sort(ns_cmp).map(function(ns) {
        var p;
        p = ns.prefix();
        if (p != null) {
          return " xmlns:" + p + "=\"" + (ns.href()) + "\"";
        } else {
          return " xmlns=\"" + (ns.href()) + "\"";
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
          cap = capture();
          ref = node.childNodes();
          for (l = 0, len3 = ref.length; l < len3; l++) {
            c = ref[l];
            this.print(c, cap, kind, new_indent);
          }
          this.print_text(cap.result, out, kind, new_indent);
        } else {
          ref1 = node.childNodes();
          for (o = 0, len4 = ref1.length; o < len4; o++) {
            c = ref1[o];
            this.print(c, out, kind, new_indent);
          }
        }
        if (kind.elements && !kind.nonempty) {
          out("\n" + (spaces(this.indent_spaces * indent)));
        }
        out("</" + kind.name + ">");
      } else {
        out("/>");
      }
      if ((parent_kind != null ? parent_kind.mixed : void 0) && (((ref2 = node.nextSibling()) != null ? ref2.type() : void 0) === "text") && (!node.nextSibling().text().match(/^\./))) {
        return out(" ");
      }
    };

    Denter.prototype.print_text = function(t, out, parent_kind, indent) {
      var len, ttl;
      ttl = t.trim().length;
      if (!parent_kind.elements || ttl > 0) {
        t = t.replace(/([^.])\s+/g, "$1 ");
        t = t.replace(/[.]\n\s*(?!$)/g, ".  ");
        t = t.trim();
        ttl = t.length;
        len = ttl + parent_kind.right_pos + parent_kind.name.length + 3;
        if ((this.right_margin > 0) && (len > this.right_margin)) {
          out("\n");
          t = ww(t.trim(), {
            width: this.right_margin - (this.indent_spaces * indent),
            indent: spaces(this.indent_spaces * indent)
          });
          out(t);
          out("\n");
          return out(spaces(this.indent_spaces * (indent - 1)));
        } else {
          return out(t);
        }
      }
    };

    Denter.prototype.print = function(node, out, parent_kind, indent) {
      var ref;
      if (parent_kind == null) {
        parent_kind = null;
      }
      if (indent == null) {
        indent = 0;
      }
      switch (node.type()) {
        case 'element':
          return this.print_element(node, out, parent_kind, indent);
        case 'text':
          if (ref = parent_kind.name, indexOf.call(this.ignore, ref) >= 0) {
            return out(escape(node.text()));
          } else {
            return this.print_text(escape(node.text()), out, parent_kind, indent);
          }
          break;
        case 'cdata':
          return out("<![CDATA[" + (node.text()) + "]]>");
        case 'comment':
          return out("<!-- " + (node.text().trim()) + " -->");
      }
    };

    Denter.prototype.print_doc = function(doc, out) {
      if (!this.noversion) {
        out("<?xml version=\"" + (doc.version()) + "\"?>");
      }
      this.print(doc.root(), out);
      return out("\n");
    };

    return Denter;

  })();

  this.dent = function(xml, opts, out) {
    var doc;
    if (out == null) {
      out = process.stdout.write.bind(process.stdout);
    }
    if (typeof opts === 'function') {
      out = opts;
      opts = {};
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
    return new Denter(opts).print_doc(doc, out);
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

  read_config = function(opts, cb) {
    return fs.exists(opts.config, function(exists) {
      if (!exists) {
        return cb(null, opts);
      }
      return fs.readFile(opts.config, function(err, data) {
        var config;
        if (err != null) {
          return cb(err);
        }
        config = JSON.parse(data);
        opts.ignore = opts.ignore.concat(config.ignore);
        opts.spaces = config.spaces || opts.spaces;
        opts.margin = config.margin || opts.margin;
        opts.html = !!config.html || opts.html;
        return cb(null, opts);
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
    program.version(pkg.version).option('-i, --ignore <name>', 'Ignore elements with name for wrapping []', collect, []).option('-o, --output <file>', 'Output file name [stdout]').option('-c, --config <file>', 'Config file to read [./.dent.json]', './.dent.json').option('-m, --margin <int>', 'Right margin in spaces [78]', pi, 78).option('-s, --spaces <int>', 'Number of spaces to indent [2]', pi, 2).option('-n, --noversion', 'Don\'t output xml version prefix [false]').option('--html', 'Parse and generate HTML instead of XML [look at filename]').usage('[options] [file...]').parse(args);
    if (program.args.length === 0) {
      program.args.push('-');
    }
    if ((program.html == null) && program.args[0].match(/.html?$/)) {
      program.html = true;
    }
    return read_config(program, (function(_this) {
      return function() {
        var d, j, len1, ref;
        ref = program.args;
        for (j = 0, len1 = ref.length; j < len1; j++) {
          d = ref[j];
          _this.dentFile(d, program, function(er, output) {});
          if (typeof er !== "undefined" && er !== null) {
            return cb(er);
          }
          cb(null);
        }
      };
    })(this));
  };

}).call(this);

//# sourceMappingURL=dentin.js.map
