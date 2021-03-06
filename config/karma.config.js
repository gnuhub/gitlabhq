var path = require('path');
var webpack = require('webpack');
var argumentsParser = require('commander');
var webpackConfig = require('./webpack.config.js');
var ROOT_PATH = path.resolve(__dirname, '..');

// remove problematic plugins
if (webpackConfig.plugins) {
  webpackConfig.plugins = webpackConfig.plugins.filter(function(plugin) {
    return !(
      plugin instanceof webpack.optimize.CommonsChunkPlugin ||
      plugin instanceof webpack.optimize.ModuleConcatenationPlugin ||
      plugin instanceof webpack.DefinePlugin
    );
  });
}

var testFiles = argumentsParser
  .option(
    '-f, --filter-spec [filter]',
    'Filter run spec files by path. Multiple filters are like a logical OR.',
    (val, memo) => {
      memo.push(val);
      return memo;
    },
    []
  )
  .parse(process.argv).filterSpec;

webpackConfig.plugins.push(
  new webpack.DefinePlugin({
    'process.env.TEST_FILES': JSON.stringify(testFiles),
  })
);

webpackConfig.devtool = process.env.BABEL_ENV !== 'coverage' && 'cheap-inline-source-map';

// Karma configuration
module.exports = function(config) {
  process.env.TZ = 'Etc/UTC';

  var progressReporter = process.env.CI ? 'mocha' : 'progress';

  var karmaConfig = {
    basePath: ROOT_PATH,
    browsers: ['ChromeHeadlessCustom'],
    customLaunchers: {
      ChromeHeadlessCustom: {
        base: 'ChromeHeadless',
        displayName: 'Chrome',
        flags: [
          // chrome cannot run in sandboxed mode inside a docker container unless it is run with
          // escalated kernel privileges (e.g. docker run --cap-add=CAP_SYS_ADMIN)
          '--no-sandbox',
        ],
      },
    },
    frameworks: ['jasmine'],
    files: [
      { pattern: 'spec/javascripts/test_bundle.js', watched: false },
      { pattern: 'spec/javascripts/fixtures/**/*@(.json|.html|.html.raw|.png)', included: false },
    ],
    preprocessors: {
      'spec/javascripts/**/*.js': ['webpack', 'sourcemap'],
    },
    reporters: [progressReporter],
    webpack: webpackConfig,
    webpackMiddleware: { stats: 'errors-only' },
  };

  if (process.env.BABEL_ENV === 'coverage' || process.env.NODE_ENV === 'coverage') {
    karmaConfig.reporters.push('coverage-istanbul');
    karmaConfig.coverageIstanbulReporter = {
      reports: ['html', 'text-summary'],
      dir: 'coverage-javascript/',
      subdir: '.',
      fixWebpackSourcePaths: true,
    };
    karmaConfig.browserNoActivityTimeout = 60000; // 60 seconds
  }

  if (process.env.DEBUG) {
    karmaConfig.logLevel = config.LOG_DEBUG;
    process.env.CHROME_LOG_FILE = process.env.CHROME_LOG_FILE || 'chrome_debug.log';
  }

  if (process.env.CHROME_LOG_FILE) {
    karmaConfig.customLaunchers.ChromeHeadlessCustom.flags.push('--enable-logging', '--v=1');
  }

  config.set(karmaConfig);
};
