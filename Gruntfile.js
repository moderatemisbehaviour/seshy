module.exports = function (grunt) {
  grunt.initConfig({
    clean: {
      output: 'output/**'
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            cwd: 'main/',
            src: ['**'],
            dest: 'output/'
          },
          {
            src: [
              'node_modules/material-components-web/dist/material-components-web.js'
            ],
            dest: 'output/'
          },
          {
            src: [
              'node_modules/material-components-web/dist/material-components-web.css'
            ],
            dest: 'output/'
          }
        ]
      },
      test: {
        files: [
          {
            src: [
              'test/**',
              '!test/manifest.json',
              'node_modules/jasmine-core/lib/jasmine-core/**'
            ],
            dest: 'output/'
          },
          {
            expand: true,
            flatten: true,
            src: ['test/manifest.json'],
            dest: 'output/'
          }
        ]
      }
    },
    crx: {
      main: {
        src: [
          'main/**',
          'node_modules/material-components-web/dist/material-components-web.js',
          'node_modules/material-components-web/dist/material-components-web.css'
        ],
        dest: 'output/seshy.crx',
        options: {
          privateKey: 'seshy-development.pem'
        }
      },
      test: {
        src: 'output/**',
        dest: 'output/test.crx',
        options: {
          privateKey: 'seshy-development.pem'
        }
      }
    },
    eslint: {
      target: ['main/js/*', 'test/*.js', 'test/spec/**/*.js']
    },
    exec: {
      test: {
        cmd: 'node output/test/run-tests.js'
      },
      main: {
        cmd:
          'google-chrome-stable --load-extension="output/seshy.crx" --user-data-dir=/tmp/seshy/chrome-development-user-profile --no-first-run --disable-gpu'
      }
    },
    compress: {
      main: {
        files: [
          {
            expand: true,
            cwd: 'main/',
            src: ['**']
          },
          {
            src: [
              'node_modules/material-components-web/dist/material-components-web.js'
            ]
          },
          {
            src: [
              'node_modules/material-components-web/dist/material-components-web.css'
            ]
          }
        ],
        options: {
          archive: 'output/seshy.zip',
          mode: 'zip'
        }
      }
    },
    update_json: {
      options: {
        src: 'package.json',
        indent: '\t'
      },
      main: {
        dest: 'main/manifest.json',
        fields: 'version, description'
      },
      test: {
        dest: 'test/manifest.json',
        fields: 'version, description'
      }
    },
    webstore_upload: {
      accounts: {
        default: {
          publish: true,
          client_id: process.env.SESHY_CLIENT_ID,
          client_secret: process.env.SESHY_CLIENT_SECRET,
          refresh_token: process.env.SESHY_REFRESH_TOKEN
        }
      },
      extensions: {
        seshy: {
          appID: 'noeieddjehppejohbbchbcmheecaneac',
          zip: 'output/seshy.zip'
        }
      }
    }
  })

  grunt.loadNpmTasks('grunt-contrib-clean')
  grunt.loadNpmTasks('grunt-contrib-compress')
  grunt.loadNpmTasks('grunt-contrib-copy')
  grunt.loadNpmTasks('grunt-crx')
  grunt.loadNpmTasks('grunt-eslint')
  grunt.loadNpmTasks('grunt-exec')
  grunt.loadNpmTasks('grunt-update-json')
  grunt.loadNpmTasks('grunt-webstore-upload')

  grunt.registerTask('lint', ['eslint'])
  grunt.registerTask('test', ['lint', 'clean', 'copy', 'crx:test', 'exec:test'])
  // TODO Can selectively copy files into CRX so earlier copy and clean tasks may be unnecessary.
  grunt.registerTask('start', ['clean', 'copy:main', 'exec:main'])
  grunt.registerTask('publish', [
    'update_json',
    'compress:main',
    'webstore_upload'
  ])
}
