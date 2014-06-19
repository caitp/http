import {Deferred} from 'prophecy/Deferred';
import {IConnection} from '../../src/IConnection';
import {PromiseBackend} from 'prophecy/PromiseMock';

export class ResponseMap extends Map {
  constructor() {
    super();
    this.set('body', null);
    this.set('code', null);
  }

  respond(code:number, body:string) {
    this.set('code', code);
    this.set('body', body);
  }
}

/**
 * TODO (@jeffbcross): support expectGET, in a way that also allows post-request
 * inspection of history of requests made.
 * TODO (@jeffbcross): add methods to verify no outstanding connections or
 * responses.
 */
export class ConnectionMockBackend {
  static flush() {
    var responses, connections;
    responses = ConnectionMockBackend.requestResponseMap;
    connections = ConnectionMockBackend.connections;
    if (!responses) {
      throw new ReferenceError('There are no responses to fulfill');
    }

    if (!connections || !connections.length) {
      throw new ReferenceError('There are no connections to resolve');
    }

    connections.forEach(function(connection) {
      if (responses.has(connection.method) &&
          responses.get(connection.method).has(connection.url)) {

        var responseMap = responses.
            get(connection.method).
            get(connection.url);
        if (responseMap.get('code') > 399) {
          connection.deferred.reject(responseMap.get('body'));
        }
        else {
          connection.deferred.resolve(responseMap.get('body'));
        }
      }
    });

    PromiseBackend.flush(true);
  }

  static whenRequest(method:string, url:string) {
    if (!ConnectionMockBackend.requestResponseMap) {
      ConnectionMockBackend.requestResponseMap = new Map();
    }
    if (!ConnectionMockBackend.requestResponseMap.has(method)) {
      ConnectionMockBackend.requestResponseMap.set(method, new Map());
    }

    var responseMap = new ResponseMap();
    ConnectionMockBackend.requestResponseMap.get(method).set(url, responseMap);
    return responseMap;
  }

  static addConnection(connection:IConnection) {
    if (!ConnectionMockBackend.connections) {
      ConnectionMockBackend.connections = [];
    }
    ConnectionMockBackend.connections.push(connection);
  }

  static forkZone() {
    return PromiseBackend.forkZone();
  }

  static setRequestHeader () {

  }
}


export class ConnectionMock {
  constructor() {
    this.deferred = new Deferred();
  }

  open(method:string, url:string) {
    this.method = method;
    this.url = url;
  }

  send(data) {
    this.data = data;
    ConnectionMockBackend.addConnection(this);
  }

  then(success, error) {
    this.deferred.promise.then.call(this.deferred.promise, success, error);
  }

  success() {
    //TODO: implement
  }

  error() {
    //TODO: implement
  }

  setRequestHeader (key:string, value:string) {
    ConnectionMockBackend.setRequestHeader(key, value);
  }
}
