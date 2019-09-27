(In)dent XML and HTML
=====================

All of the pretty-printers I found for XML and HTML didn't work well enough, so
I spent way too much time putting this together.

Usage
-----

    dentin [options] [file...]

    Options:

      -h, --help           output usage information
      -V, --version        output the version number
      -i, --ignore <name>  Ignore elements with name for wrapping []
      -o, --output <file>  Output file name [stdout]
      -c, --config <file>  Config file to read [./.dent.json]
      -m, --margin <int>   Right margin in spaces [78]
      -s, --spaces <int>   Number of spaces to indent [2]
      --html               Parse and generate HTML instead of XML [look at filename]

[![Build Status](https://travis-ci.org/hildjj/dentin.svg?branch=master)](https://travis-ci.org/hildjj/dentin)
[![Coverage Status](https://coveralls.io/repos/github/hildjj/dentin/badge.svg?branch=master)](https://coveralls.io/github/hildjj/dentin?branch=master)
