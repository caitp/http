var allTestFiles = [];
var TEST_REGEXP = /\.spec\.js$/;

var pathToModule = function(path) {
  return path.replace(/^\/base\//, '').replace(/\.js$/, '');
};

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(pathToModule(file));
  }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base',

  paths: {
    'q': './node_modules/di/node_modules/q/q',
    'di': './node_modules/di/src',
    'assert': './node_modules/rtts-assert/dist/amd/assert',
    'deferred': './node_modules/deferred/src'
  },

  // Dynamically load all test files and ES6 polyfill.
  deps: allTestFiles.concat(['node_modules/di/node_modules/es6-shim/es6-shim', 'test/matchers']),

  // we have to kickoff jasmine, as it is asynchronous
  callback: window.__karma__.start
});
