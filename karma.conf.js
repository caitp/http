var sharedConfig = require('pipe/karma');

module.exports = function(config) {
  sharedConfig(config);

  config.set({
    // list of files / patterns to load in the browser
    files: [
      'test-main.js',

      {pattern: 'src/**/*.js', included: false},
      {pattern: 'test/**/*.js', included: false},
      {pattern: 'node_modules/es6-shim/es6-shim.js', included: false},
      {pattern: 'node_modules/di/src/*.js', included: false}
    ],

    preprocessors: {
      'node_modules/di/src/*.js': ['traceur'],
      'src/**/*.js': ['traceur'],
      'test/**/*.js': ['traceur'],
    }
  });

  config.sauceLabs.testName = 'ngHttp';
};
