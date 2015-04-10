module.exports = function(grunt) {
  // Load Grunt tasks declared in the package.json file
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: {
      all: ['coverage', 'doc', 'lib', 'man'],
      coverage: ['coverage'],
      doc: ['doc'],
      lib: ['lib']
    },
    checkDependencies: {
      check: {
        verbose: true
      },
      install: {
        install: true
      }
    },
    coffee: {
      options: {
        sourceMap: true
      },
      compile: {
        expand: true,
        flatten: true,
        cwd: 'src',
        src: ['*.coffee'],
        dest: 'lib/',
        ext: '.js'
      }
    },
    codo: {
      src: ['src'],
      options: {
        name: "json-text-sequence",
        title: "json-text-sequence API Documentation",
        extras: [ "LICENSE.md" ]
      }
    },
    coffeelint: {
      src: ['src/*.coffee'],
      options: {
        configFile: 'coffeelint.json'
      }
    },
    coveralls: {
      all: {
        src: 'coverage/lcov.info'
      }
    },
    nodeunit: {
      all: ['test']
    },
    shell: {
      istanbul: {
        stdout: true,
        stderr: true,
        command: 'node_modules/.bin/istanbul cover node_modules/.bin/nodeunit test/*.coffee'
      },
      examples: {
        command: './bin/xmljade examples/test.jade examples/test.xml -o examples/test.html -p'
      }
    },
    express: {
      all: {
        options: {
          port: 9000,
          hostname: "0.0.0.0",
          bases: 'coverage/lcov-report',
          livereload: true,
          open: 'http://localhost:<%= express.all.options.port%>/lib'
        }
      }
    },
    watch: {
      coffee: {
        files: ['src/*.coffee', 'bin/*'],
        tasks: ['coffee'],
        options: {
          livereload: true
        }
      }
    },
    release: {
      options: {
        tagName: 'v<%= version %>', //default: '<%= version %>'
      }
    }
  });

  grunt.registerTask('default', ['test']);
  grunt.registerTask('prepublish', ['clean', 'coffee', 'codo']);
  grunt.registerTask('doc', ['clean:doc', 'codo']);
  grunt.registerTask('test', ['coffee', 'nodeunit']);
  grunt.registerTask('server', ['test', 'shell:istanbul', 'express', 'watch']);
  grunt.registerTask('coverage', ['coffee', 'shell:istanbul'])
  grunt.registerTask('ci', ['coverage', 'coveralls']);
  grunt.registerTask('examples', ['coffee', 'shell:examples']);
  grunt.registerTask('depend', ['checkDependencies:check']);
};