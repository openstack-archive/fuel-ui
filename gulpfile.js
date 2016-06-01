/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

/*eslint-disable strict*/

'use strict';

var argv = require('minimist')(process.argv.slice(2));

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var rimraf = require('rimraf');
var _ = require('lodash');

var webpack = require('webpack');

var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true, hideDepsMessage: true});
var gutil = require('gulp-util');
var shell = require('gulp-shell');
var runSequence = require('run-sequence');

var filter = require('gulp-filter');
var replace = require('gulp-replace');
var jison = require('gulp-jison');

var validateTranslations = require('./gulp/i18n').validate;
gulp.task('i18n:validate', function() {
  fs.readFile('static/translations/core.json', function(err, data) {
    if (err) throw err;
    var tranlations = JSON.parse(data);
    var locales = argv.locales ? argv.locales.split(',') : null;
    validateTranslations(tranlations, locales);
  });
});

var seleniumProcess = null;
function shutdownSelenium() {
  if (seleniumProcess) {
    seleniumProcess.kill();
    seleniumProcess = null;
  }
}

var SELENIUM_VERSION = '2.52.0';
var SELENIUM_DRIVERS = {};

gulp.task('selenium:fetch', function(cb) {
  var selenium = require('selenium-standalone');
  selenium.install({
    version: process.env.SELENIUM_VERSION || SELENIUM_VERSION,
    dirvers: SELENIUM_DRIVERS
  }, cb);
});

gulp.task('selenium', ['selenium:fetch'], function(cb) {
  var selenium = require('selenium-standalone');
  var port = process.env.SELENIUM_SERVER_PORT || 4444;
  selenium.start(
    {
      version: process.env.SELENIUM_VERSION || SELENIUM_VERSION,
      dirvers: SELENIUM_DRIVERS,
      seleniumArgs: ['--port', port],
      spawnOptions: {stdio: 'pipe'}
    },
    function(err, child) {
      if (err) throw err;
      child.on('exit', function() {
        if (seleniumProcess) {
          gutil.log(gutil.colors.yellow('Selenium process died unexpectedly. Probably port',
            port, 'is already in use.'));
        }
      });
      ['exit', 'uncaughtException', 'SIGTERM', 'SIGINT'].forEach(function(event) {
        process.on(event, shutdownSelenium);
      });
      seleniumProcess = child;
      cb();
    }
  );
});

gulp.task('karma', function(cb) {
  var Server = require('karma').Server;
  new Server({
    configFile: path.join(__dirname, '/karma.config.js'),
    browsers: [argv.browser || process.env.BROWSER || 'firefox']
  }, cb).start();
});

gulp.task('unit-tests', 'Run unit tests.', function(cb) {
  runSequence('selenium', 'karma', function(err) {
    shutdownSelenium();
    cb(err);
  });
}, {
  options: {
    'browser=[firefox]': 'browser to execute tests against'
  }
});

var originalBaseDir = 'static/';
var transpiledBaseDir = 'static/build/intern/';

function runIntern(suites, browser) {
  return function() {
    var runner = './node_modules/.bin/intern-runner';
    var config = {
      environments: [{browserName: browser}],
      excludeInstrumentation: true,
      reporters: ['Runner', 'tests/functional/screenshot_on_fail']
    };
    var configFile = 'tests/functional/config.js';
    var configFileContents = 'define(function(){return' + JSON.stringify(config) + '})';
    fs.writeFileSync( // eslint-disable-line no-sync
      path.join(transpiledBaseDir, configFile),
      configFileContents
    );

    var suiteFiles = glob.sync(path.relative(originalBaseDir, suites), {cwd: originalBaseDir});
    if (!suiteFiles.length) throw new Error('No matching suites');
    var suiteOptions = suiteFiles.map(function(suiteFile) {
      return ['functionalSuites', suiteFile.replace(/\.js$/, '')];
    });

    var options = [['config', configFile]];
    options = options.concat(suiteOptions);
    var command = [path.relative(transpiledBaseDir, runner)].concat(options.map(function(option) {
      return option.join('=');
    })).join(' ');

    gutil.log('Executing', command);

    return shell.task(command, {cwd: transpiledBaseDir})();
  };
}

gulp.task('intern:transpile', function() {
  var source = path.join(originalBaseDir, 'tests/functional/**/*.js');
  var target = path.join(transpiledBaseDir, 'tests/functional/');
  rimraf.sync(target);
  return gulp.src(source)
    .pipe(require('gulp-babel')({
      presets: ['es2015-webpack'],
      plugins: ['transform-es2015-modules-simple-amd']
    }))
    .pipe(gulp.dest(target));
});

gulp.task('intern:run', runIntern(
  argv.suites || 'static/tests/functional/**/test_*.js',
  argv.browser || process.env.BROWSER || 'firefox'
));

gulp.task('functional-tests', 'Run functional tests.', function(cb) {
  var tasks = ['selenium', argv.transpile === false ? null : 'intern:transpile', 'intern:run'];
  runSequence.apply(this, _.compact(tasks).concat(function(err) {
    shutdownSelenium();
    cb(err);
  }));
}, {
  options: {
    'suites': 'functional test suites to be run',
    'browser=[firefox]': 'browser to execute tests against'
  }
});

gulp.task('jison', function() {
  return gulp.src('static/expression/parser.jison')
    .pipe(jison({moduleType: 'js'}))
    .pipe(gulp.dest('static/expression/'));
});

gulp.task('license', function(cb) {
  require('nlf').find({depth: 0}, function(err, data) {
    if (err) return cb(err);
    // http://governance.openstack.org/reference/licensing.html
    // The list of acceptable licenses includes ASLv2, BSD (both forms),
    // MIT, PSF, LGPL, ISC, and MPL
    var licenseRegexp = /(Apache.*?2)|\bBSD\b|\bMIT\b|\bPSF\b|\bLGPL\b|\bISC\b|\bMPL\b/i;

    var errors = [];
    _.each(data, function(moduleInfo) {
      var name = moduleInfo.name;
      var version = moduleInfo.version;
      var license = _.map(moduleInfo.licenseSources.package.sources, 'license').join(', ') ||
        'unknown';
      var licenseOk = license.match(licenseRegexp);
      if (!licenseOk) errors.push({libraryName: name, license: license});
      gutil.log(
        gutil.colors.cyan(name),
        gutil.colors.yellow(version),
        gutil.colors[licenseOk ? 'green' : 'red'](license)
      );
    });
    if (errors.length) {
      _.each(errors, function(error) {
        gutil.log(gutil.colors.red(error.libraryName, 'has', error.license, 'license'));
      });
      return cb('Issues with licenses found');
    } else {
      return cb();
    }
  });
});

var jsFiles = [
  '*.js',
  'gulp/*.js',
  'static/**/*.js',
  '!static/build/**',
  '!static/vendor/**',
  '!static/expression/parser.js'
];
var styleFiles = [
  'static/**/*.less',
  'static/**/*.css',
  '!static/build/**'
];

gulp.task('eslint', function() {
  var eslint = require('gulp-eslint');
  return gulp.src(jsFiles)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('lintspaces:styles', function() {
  var lintspaces = require('gulp-lintspaces');
  return gulp.src(styleFiles)
    .pipe(lintspaces({
      showValid: true,
      newline: true,
      trailingspaces: true,
      indentation: 'spaces',
      ignores: ['js-comments'],
      spaces: 2,
      newlineMaximum: 2
    }))
    .pipe(lintspaces.reporter());
});

gulp.task('lint', 'Run lint checks.', [
  'eslint',
  'lintspaces:styles'
]);

var WEBPACK_STATS_OPTIONS = {
  colors: true,
  hash: false,
  version: false,
  assets: false,
  chunks: false
};

gulp.task('dev-server', 'Launch development server.', function() {
  var devServerHost = argv['dev-server-host'] || '127.0.0.1';
  var devServerPort = argv['dev-server-port'] || 8080;
  var devServerUrl = 'http://' + devServerHost + ':' + devServerPort;
  var nailgunHost = argv['nailgun-host'] || '127.0.0.1';
  var nailgunPort = argv['nailgun-port'] || 8000;
  var nailgunUrl = 'http://' + nailgunHost + ':' + nailgunPort;
  var hotReload = !argv['no-hot'];

  var config = require('./webpack.config');
  config.entry.push('webpack-dev-server/client?' + devServerUrl);
  if (hotReload) {
    config.entry.push('webpack/hot/dev-server');
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
    config.plugins.push(new webpack.NoErrorsPlugin());
  }

  var WebpackDevServer = require('webpack-dev-server');
  var options = {
    hot: hotReload,
    stats: WEBPACK_STATS_OPTIONS,
    proxy: [
      {path: '/', target: devServerUrl, rewrite: function(req) {
        req.url = '/static/index.html';
      }},
      {path: /^\/(?!static\/).+/, target: nailgunUrl}
    ]
  };
  _.extend(options, config.output);
  new WebpackDevServer(webpack(config), options).listen(devServerPort, devServerHost,
    function(err) {
      if (err) throw err;
      gutil.log('Development server started at ' + devServerUrl);
    });
}, {
  options: {
    'dev-server-host=[127.0.0.1]': 'server host',
    'dev-server-port=[8080]': 'server port',
    'nailgun-host=[127.0.0.1]': 'nailgun host',
    'nailgun-port=[8000]': 'nailgun port',
    'no-hot': 'disable hot reloading'
  }
});

gulp.task('build', 'Build the project.', function(cb) {
  var sourceDir = path.resolve('static');
  var targetDir = argv['static-dir'] ? path.resolve(argv['static-dir']) : sourceDir;

  var config = require('./webpack.config');
  config.output.path = path.join(targetDir, 'build');
  if (!argv.dev) {
    config.plugins.push(
      new webpack.DefinePlugin({'process.env': {NODE_ENV: '"production"'}})
    );
  }
  if (argv['extra-entries']) {
    config.entry = config.entry.concat(argv['extra-entries'].split(','));
  }

  if (argv.uglify !== false) {
    config.devtool = 'source-map';
    config.plugins.push(
      new webpack.optimize.UglifyJsPlugin({
        sourceMap: true,
        mangle: false,
        compress: {warnings: false}
      })
    );
  }
  if (argv.sourcemaps === false) {
    delete config.devtool;
  }
  if (argv.watch) {
    config.watch = true;
  }

  rimraf.sync(config.output.path);

  var compiler = webpack(config);
  var run = config.watch ? compiler.watch.bind(compiler, config.watchOptions) :
    compiler.run.bind(compiler);

  run(function(err, stats) {
    if (err) return cb(err);

    gutil.log(stats.toString(WEBPACK_STATS_OPTIONS));

    if (stats.hasErrors()) return cb('Build failed');

    if (targetDir !== sourceDir) {
      var indexFilter = filter('index.html');
      gulp
        .src([
          'index.html',
          'favicon.ico',
          'img/loader-bg.svg',
          'img/loader-logo.svg',
          'styles/layout.css'
        ], {cwd: sourceDir, base: sourceDir})
        .pipe(indexFilter)
        .pipe(replace('__CACHE_BUST__', Date.now()))
        .pipe(indexFilter.restore())
        .pipe(gulp.dest(targetDir))
        .on('end', cb);
    } else if (!config.watch) {
      return cb();
    }
  });
});

gulp.task('default', ['build']);
