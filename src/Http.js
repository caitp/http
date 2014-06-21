import {XHRConnection} from './XHRConnection';
import {assert} from 'assert';
import {serialize} from './Serialize';
import {toQueryString} from './QueryParams';
import {Provide} from 'di/annotations';
import {IResponse} from './IResponse';
import {IRequest} from './IRequest';

class Http {
  constructor () {
    this.globalInterceptors = {
      request: [],
      response: []
    };
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

  intercept ({err, req, res, key}) {
    assert.type(req, IRequest);
    res && assert.type(res, IResponse);
    var http = this,
        i = 0,
        args = arguments;

    return callNext();

    function callNext() {
      if (i === http.globalInterceptors[key].length) {
        if (err) return Promise.reject(err);
        return Promise.resolve(key === 'request' ? req : res);
      }
      else {
        return Promise.resolve(http.globalInterceptors[key][i++](err, req, res)).then(callNext);
      }
    }
  }
}

function fullUrl (url:string, params) {
  return url + toQueryString(params, url.indexOf('?') > -1);
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
