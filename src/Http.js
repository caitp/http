import {XHRConnection} from './XHRConnection';
import {assert} from 'assert';
import {serialize} from './Serialize';
import {toQueryString} from './QueryParams';
import {Provide} from 'di/annotations';

class Http {
  constructor () {
  }

  request (method:string, url:string, options) {
    var queryParams, requestData, connection;
    assert.type(method, assert.string);
    assert.type(url, assert.string);

    queryParams = (options && options.params || {});
    requestData = (options && options.data);
    connection = new (options && options.ConnectionClass || XHRConnection)();
    url = this.fullUrl(url, queryParams);

    connection.open(method, url);
    connection.send(serialize(requestData));

    return connection;
  }

  fullUrl (url:string, params) {
    var hash = url.indexOf('#');
    if (hash >= 0) {
      url = url.substring(0, hash);
    }
    return url + toQueryString(params, url.indexOf('?') > -1);
  }
}

export {Http};
