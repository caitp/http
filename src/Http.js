import {Deferred} from 'prophecy/Deferred';
import {XHRConnection} from './XHRConnection';
import {assert} from 'assert';
import {serialize} from './Serialize';
import {toQueryString} from './QueryParams';
import {Provide} from 'di/annotations';
import {IInterceptResolution} from './IInterceptResolution';
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
        return http.intercept({
          req: request,
          res: response,
          interceptType: 'response'
        });
      }

      function onResponseError (reason) {
        return http.intercept({
          err: reason,
          req: request,
          interceptType: 'response'
        });
      }

      http.intercept({req: request, interceptType: 'request'}).
        then(setHeaders).
        then(openConnection).
        then(onResponse, onResponseError).
        then(resolve, reject);
    });
  }

  /**
   * Creates a promise chain of interceptors from the globalInterceptors
   * object, based on the 'interceptType' property of resolution
   */
  intercept (resolution:IInterceptResolution) {
    var deferred = new Deferred(),
        interceptors;

    for (var i = 0; i < this.globalInterceptors[resolution.interceptType].length; i++) {
      interceptors = this.globalInterceptors[resolution.interceptType][i];
      deferred.promise = deferred.promise.then(interceptors.resolve, interceptors.reject);
    }

    deferred[resolution.err ? 'reject' : 'resolve'](resolution);
    return deferred.promise;
  }
}

function fullUrl (url:string, params:Map) {
  var hash = url.indexOf('#'), separator;
  if (hash >= 0) {
    url = url.substring(0, hash);
  }
  separator = url.indexOf('?') > -1 ? '&' : '?';
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
