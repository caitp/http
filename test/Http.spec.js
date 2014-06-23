import {Http, fullUrl, objectToMap} from '../src/Http';
import {XHRConnection} from '../src/XHRConnection';
import {assert} from 'assert';
import {IConnection} from '../src/IConnection';
import {Injector} from 'di/injector';
import {inject, use} from 'di/testing';
import {ConnectionMock, ConnectionMockBackend, ConnectionMockFactory} from './mocks/ConnectionMock';
import {PromiseBackend} from 'prophecy/PromiseMock';

describe('Http', function() {
  var http, defaultConfig;

  beforeEach(inject(Http, function(_http_) {
    defaultConfig = {method: 'GET', url: '/users'};
    http = _http_;
    PromiseBackend.patchWithMock();
  }));

  afterEach(function() {
    PromiseBackend.restoreNativePromise();
  })


  describe('constructor', function() {
    it('should be injectable', inject(Http, function(http) {
      assert.type(http.request, Function);
    }));


    it('should create a defaultInterceptors object', function() {
      expect(http.globalInterceptors).toEqual({
        request: [],
        response: []
      });
    });
  });


  describe('request()', function() {
    var openSpy, sendSpy;
    beforeEach(function() {
      openSpy = spyOn(XHRConnection.prototype, 'open');
      sendSpy = spyOn(XHRConnection.prototype, 'send');
    });


    it('should complain if method is not a string', function() {
      var spy = jasmine.createSpy('rejectSpy');
      http.request({method: undefined, url: '/users'}).then(null, spy);
      PromiseBackend.flush(true);
      expect(spy).toHaveBeenCalled();
    });


    it('should complain if url is not a string', function() {
      var spy = jasmine.createSpy('rejectSpy');
      http.request({method: 'GET', url: undefined}).then(null, spy);
      PromiseBackend.flush(true);
      expect(spy).toHaveBeenCalled();
    });


    it('should serialize data before calling open', function() {
      http.request({method: 'GET', url: '/users', data: {interests: 'JavaScript'}});
      PromiseBackend.flush(true);
      expect(sendSpy.calls.all()[0].args[0]).toBe('{"interests":"JavaScript"}');
    });


    it('should return a promise', function() {
      assert.type(http.request(defaultConfig).then, Function);
    });


    it('should call open on the connection', function() {
      http.request(defaultConfig);
      PromiseBackend.flush(true);
      expect(openSpy).toHaveBeenCalledWith('GET', '/users');
    });


    it('should call send on the connection', function() {
      http.request(defaultConfig);
      PromiseBackend.flush(true);
      expect(sendSpy).toHaveBeenCalled();
    });


    it('should pass data to send', function() {
      var data = '{"user" : "jeffbcross"}';
      http.request({method: 'GET', url: '/users', data: data});
      PromiseBackend.flush(true);
      expect(sendSpy).toHaveBeenCalledWith(data);
    });


    it('should send the request through the request interceptor', function() {
      var spy = jasmine.createSpy('interceptor');
      spy.and.returnValue({headers:{}});
      http.globalInterceptors.request.push(spy);
      http.request(defaultConfig);
      expect(spy).toHaveBeenCalled();
    });


    it('should apply request headers set in the interceptor', function() {
      var headerSpy = spyOn(XHRConnection.prototype, 'setRequestHeader');
      function interceptor(err, request) {
        request.headers.set('Client', 'Browser');
        return request;
      }
      http.globalInterceptors.request.push(interceptor);
      http.request(defaultConfig);
      PromiseBackend.flush(true);
      expect(headerSpy).toHaveBeenCalledWith('Client', 'Browser');
    });


    it('should call intercept with the Request object', function() {
      var spy = spyOn(http, 'intercept').and.callThrough();
      http.request({method: 'GET', url: '/something'});
      PromiseBackend.flush(true);
      expect(spy).toHaveBeenCalled();
      expect(spy.calls.argsFor(0)[0].req.method).toBe('GET');
      expect(spy.calls.argsFor(0)[0].req.url).toBe('/something');
    });


    it('should call intercept with the raw response upon successful request', function() {
      var spy = spyOn(http, 'intercept').and.callThrough();
      ConnectionMockBackend.whenRequest('GET', '/users').respond(200, 'rawbody');
      http.request({
        method: 'GET',
        url: '/users',
        ConnectionClass: ConnectionMock
      }).then(spy);
      PromiseBackend.flush(true);
      ConnectionMockBackend.flush();
      expect(spy).toHaveBeenCalled();
      expect(spy.calls.count()).toBe(2);
    });


    it('should call intercept with an error failure', function() {
      var spy = spyOn(http, 'intercept').and.callThrough();
      ConnectionMockBackend.whenRequest('GET', '/users').respond(404, 'error: not found');
      http.request({
        method: 'GET',
        url: '/users',
        ConnectionClass: ConnectionMock
      });
      PromiseBackend.flush(true);
      ConnectionMockBackend.flush(true);
      expect(spy.calls.argsFor(1)[0]).toBe('error: not found');
    });


    //TODO (jeffbcross): this is a badly-placed test, does not belong in unit
    //It's also bad because it relies on loading a Karma script
    //This test is merely a guide to make sure I don't lose my way
    xit('should actually execute the request', function(done) {
      http.request('GET', '/base/node_modules/pipe/node_modules/karma-requirejs/lib/adapter.js').
      then(function(res) {
        expect(res).toContain('monkey patch');
        done();
      }, function(reason){
        throw new Error(reason);
      });
    });
  });


  describe('.intercept()', function() {
    var sampleResponse, sampleRequest;

    beforeEach(function() {
      sampleRequest = {
        method: 'GET',
        url: '/users',
        headers: new Map(),
        params: new Map(),
        responseType: 'text',
        data: ''
      };

      sampleResponse = {
        headers: new Map(),
        body: 'foo',
        responseType: 'text',
        responseText: 'foo',
        status: 200
      }
    })

    it('should return a promise', function() {
      assert.type(http.intercept({req: sampleRequest, res: sampleResponse, key:'response'}).then, Function);
    });


    it('should process the response through globalInterceptors', function() {
      var goodSpy = jasmine.createSpy('goodSpy');
      var badSpy = jasmine.createSpy('badSpy');
      http.globalInterceptors.response.push(function(err, req, res) {
        res.body = res.body.replace('fo','intercepted');
        return res;
      });
      http.intercept({
        req: sampleRequest,
        res: sampleResponse,
        key: 'response'
      }).then(goodSpy, badSpy);
      PromiseBackend.flush(true);
      expect(goodSpy).toHaveBeenCalled();
      expect(goodSpy.calls.argsFor(0)[0].body).toBe('interceptedo');
      expect(badSpy).not.toHaveBeenCalled();
    });


    it('should call reject if called with an error object', function() {
      var goodSpy = jasmine.createSpy('goodSpy');
      var badSpy = jasmine.createSpy('badSpy');
      var error = {foo: 'bar'};
      http.globalInterceptors.response.push(function(err, req, res) {
        res.body = res.body.replace('raw','intercepted');
        return res;
      });
      http.intercept({
        err: error,
        req: sampleRequest,
        res: sampleResponse,
        key: 'response'
      }).then(goodSpy, badSpy);
      PromiseBackend.flush(true);
      expect(badSpy).toHaveBeenCalledWith(error);
      expect(goodSpy).not.toHaveBeenCalled();
    });


    it('should call reject if an error is ever passed to next', function() {
      var goodSpy = jasmine.createSpy('goodSpy');
      var badSpy = jasmine.createSpy('badSpy');
      var error = {foo: 'bar'};
      http.globalInterceptors.response.push(function(err, req, res) {
        res.body = res.body.replace('raw','intercepted');
        return Promise.reject(error);
      });
      http.intercept({
        req: sampleRequest,
        res: sampleResponse,
        key: 'response'
      }).then(goodSpy, badSpy);
      PromiseBackend.flush(true);
      expect(badSpy).toHaveBeenCalledWith(error);
      expect(goodSpy).not.toHaveBeenCalled();
    });


    it('should process a request through globalInterceptors', function() {
      var goodSpy = jasmine.createSpy('goodSpy');
      var badSpy = jasmine.createSpy('badSpy');
      http.globalInterceptors.request.push(function(err, req) {
        req.headers.sender = 'Jeff';
        return req;
      });
      http.intercept({
        req: sampleRequest,
        key: 'request'
      }).then(goodSpy);
      PromiseBackend.flush(true);
      expect(goodSpy.calls.argsFor(0)[0].headers.sender).toBe('Jeff');
      expect(badSpy).not.toHaveBeenCalled();
    });
  });
});


describe('fullUrl()', function() {
  it('should serialize query parameters and add to url', function() {
    var params = {name: 'Jeff'};
    expect(fullUrl('/users', params)).toBe('/users?name=Jeff');
  });


  it('should append query parameters if parameters already exist', function() {
    var params = {name: 'Jeff'};
    expect(fullUrl('/users?hair=brown', params)).toBe('/users?hair=brown&name=Jeff');
  });
});


describe('objectToMap', function() {
  it('should return a map', function() {
    assert.type(objectToMap(), Map);
  });


  it('should add properties to the map from provided object', function() {
    expect(objectToMap({foo: 'bar'}).get('foo')).toBe('bar');
  });
});
