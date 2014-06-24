import {XHRConnection} from './XHRConnection';
import {assert} from 'assert';
import {serialize} from './Serialize';
import {toQueryString} from './QueryParams';
import {Provide} from 'di/annotations';
import {IResponse} from './IResponse';
import {IRequest} from './IRequest';

class Http {
  constructor () {
    Object.defineProperty(this, 'globalInterceptors', {
      configurable: false,
      value: {
        response: [],
        request: []
      }
    });
    // Prevent response and request from being reassigned
    Object.freeze(this.globalInterceptors);
  }

  request (config) {
    var connection, http = this;
    return new Promise(function(resolve, reject) {
      var request, promise;
      var {method, url, params, data, headers, responseType} = config;
      assert.type(method, assert.string);
      assert.type(url, assert.string);

      connection = new (config.ConnectionClass || XHRConnection)();

      request = {
        method: method,
        url: url,
        data: serialize(data),
        responseType: responseType || 'text',
        params: objectToMap(params),
        headers: objectToMap(headers)
      };

      function setHeaders() {
        for (var key of request.headers.keys()) {
          connection.setRequestHeader(key, request.headers.get(key));
        }
      }

      function openConnection() {
        connection.open(request.method, request.url);
        connection.send(request.data);
        return connection;
      }

      function onResponse (response) {
        return http.intercept(null, request, response, 'response');
      }

      function onResponseError (reason) {
        return http.intercept(reason, request, null, 'response');
      }

      http.intercept({req: request, key: 'request'}).
        then(setHeaders).
        then(openConnection).
        then(onResponse, onResponseError).
        then(resolve, reject);
    });
  }

  intercept (resolution) {
    var {err, req, res, key} = resolution;
    assert.type(req, IRequest);
    res && assert.type(res, IResponse);
    var http = this,
        i = 0,
        args = arguments;

    return callNext(resolution);

    function callNext(resolution) {
      var {err, req, res} = resolution;
      var nextAction = err ? 'reject' : 'resolve';
      var interceptTuple = http.globalInterceptors[key][i];
      if (i++ === http.globalInterceptors[key].length) {
        return Promise[nextAction](resolution);
      }
      else if (interceptTuple[nextAction]) {
        return Promise[nextAction](interceptTuple[nextAction](resolution)).then(callNext, callNext);
      }
      else {
        return Promise[nextAction](resolution).then(callNext, callNext);
      }
    }
  }
}

function fullUrl (url:string, params:Map) {
  var separator = url.indexOf('?') > -1 ? '&' : '?';
  return `${url}${separator}${toQueryString(params)}`;
}

function objectToMap (object) {
  var map = new Map(), key;
  if (!object) return map;
  for (key in object) {
    if (object.hasOwnProperty(key)) {
      map.set(key, object[key]);
    }
  }
  return map;
}

export {Http, fullUrl, objectToMap};
