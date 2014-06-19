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
    var promise = new Promise(function(resolve, reject) {
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
        params: new Map(),
        headers: new Map()
      };

      function setHeaders() {
        Object.keys(request.headers).forEach(function(key) {
          connection.setRequestHeader(key, request.headers[key]);
        });
      }

      function openConnection() {
        connection.open(request.method, request.url);
        connection.send(request.data);
        return connection;
      }

      function onResponse (response) {
        return http.interceptResponse(undefined, request, response);
      }

      function onResponseError (reason) {
        return http.interceptResponse(reason, request);
      }

      http.interceptRequest(undefined, request).
        then(setHeaders).
        then(openConnection).
        then(onResponse, onResponseError).
        then(resolve, reject);
    });

    // TODO: Remove connection from promise.
    // Only here to verify which Connection was used
    promise.connection = connection;

    return promise;
  }

  interceptRequest (err, req:IRequest) {
    var http = this;

    return new Promise(function(resolve, reject) {
      var i = 0;
      function callNext(error) {
        err = error || err;
        if (i === http.globalInterceptors.request.length) {
          if (err) return reject(err);
          resolve(req);
        }
        http.globalInterceptors.request[i++](err, req, callNext);
      }
      callNext();
    });
  }

  interceptResponse (err, req:IRequest, res) {
    var http = this;
    if (res) assert.type(res, IResponse);
    return new Promise(function(resolve, reject) {
      var i = 0;
      function callNext(error) {
        err = error || err;
        if (i === http.globalInterceptors.response.length) {
          if (err) return reject(err);
          resolve(res);
        }
        http.globalInterceptors.response[i++](err, req, res, callNext);
      }
      callNext();
    });
  }
}

function fullUrl (url:string, params) {
  return url + toQueryString(params, url.indexOf('?') > -1);
}

export {Http, fullUrl};
