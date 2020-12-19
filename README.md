(In)dent XML and HTML
=====================

All of the pretty-printers I found for XML and HTML didn't work well enough, so
I spent way too much time putting this together.  It handles DTDs, mixed content,
etc. in the way that I prefer.  File bugs if you disagree and I'll likely add
config options.

Installation
------------

    npm install -g dentin

Usage
-----

    dentin [files...]
    
    Indent XML or HTML files
    
    Positionals:
      files  The files to read. To read stdin explicitly, use "-".  [default: stdin]
    
    Options:
      -i, --ignore       Ignore elements with these names, do not word-wrap them
                                                                             [array]
      -o, --output       Output file name                 [string] [default: stdout]
      -b, --backup       Replace the current file, keeping a backup of the original,
                         with the given extension.  This can be used to process
                         several files at once into different output files. [string]
      -c, --config       Read configuration information from this JSON file.
                                                           [default: ".dentin.json"]
      -d, --doubleQuote  Use double quotes for attributes [boolean] [default: false]
      -m, --margin       Line length for word wrapping        [number] [default: 78]
      -s, --spaces       How many spaces to indent each level.  0 causes left
                         alignment.  -1 strips insignificant whitespace.
                                                               [number] [default: 2]
      -n, --noVersion    Do not output the XML version or HTML doctype prefix
                                                          [boolean] [default: false]
      --html             Process these files as HTML instead of XML
                                       [boolean] [default: determine from file name]
      -Q, --fewerQuotes  In HTML docs, only use quotes around attribute values that
                         require them                     [boolean] [default: false]
      -h, --help         Show help                                         [boolean]
      -V, --version      Show version number                               [boolean]


![Node.js CI](https://github.com/hildjj/dentin/workflows/Tests/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/hildjj/dentin/badge.svg?branch=master)](https://coveralls.io/github/hildjj/dentin?branch=master)
