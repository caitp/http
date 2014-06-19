import {Http, fullUrl} from '../src/Http';
import {XHRConnection} from '../src/XHRConnection';
import {assert} from 'assert';
import {IConnection} from '../src/IConnection';
import {Injector} from 'di/injector';
import {inject, use} from 'di/testing';
import {ConnectionMock, ConnectionMockBackend, ConnectionMockFactory} from './mocks/ConnectionMock';
import {PromiseBackend} from 'deferred/PromiseMock';

describe('Http', function() {
  var http, defaultConfig;

  beforeEach(inject(Http, function(_http_) {
    defaultConfig = {method: 'GET', url: '/users'};
    http = _http_;
  }));

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
      ConnectionMockBackend.forkZone().run(function() {
        var spy = jasmine.createSpy('rejectSpy');
        http.request({method: undefined, url: '/users'}).then(null, spy);
        PromiseBackend.flush(true);
        expect(spy).toHaveBeenCalled();
      });
    });


    it('should complain if url is not a string', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var spy = jasmine.createSpy('rejectSpy');
        http.request({method: 'GET', url: undefined}).then(null, spy);
        PromiseBackend.flush(true);
        expect(spy).toHaveBeenCalled();
      });
    });


    it('should serialize data before calling open', function() {
      ConnectionMockBackend.forkZone().run(function() {
        http.request({method: 'GET', url: '/users', data: {interests: 'JavaScript'}});
        PromiseBackend.flush(true);
        expect(sendSpy.calls.all()[0].args[0]).toBe('{"interests":"JavaScript"}');
      });
    });


    it('should create a new Connection from XHRConnection if no ConnectionClass provided',
        function(){
          expect(http.request(defaultConfig).connection).toBeInstanceOf(XHRConnection);
        });


    it('should use provided ConnectionClass to instantiate a Connection', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var request = http.request({method: 'GET', url: '/users',
          ConnectionClass: ConnectionMock
        });
        PromiseBackend.flush(true);
        expect(request.connection).toBeInstanceOf(ConnectionMock);
      });
    });


    it('should return a promise', function() {
      assert.type(http.request(defaultConfig).then, Function);
    });


    it('should call open on the connection', function() {
      ConnectionMockBackend.forkZone().run(function() {
        http.request(defaultConfig);
        PromiseBackend.flush(true);
        expect(openSpy).toHaveBeenCalledWith('GET', '/users');
      });
    });


    it('should call send on the connection', function() {
      ConnectionMockBackend.forkZone().run(function() {
        http.request(defaultConfig);
        PromiseBackend.flush(true);
        expect(sendSpy).toHaveBeenCalled();
      });
    });


    it('should pass data to send', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var data = '{"user" : "jeffbcross"}';
        http.request({method: 'GET', url: '/users', data: data});
        PromiseBackend.flush(true);
        expect(sendSpy).toHaveBeenCalledWith(data);
      });

    });


    it('should send the request through the request interceptor', function() {
      var spy = jasmine.createSpy('interceptor');
      spy.and.returnValue({headers:{}});
      http.globalInterceptors.request.push(spy);
      http.request(defaultConfig);
      expect(spy).toHaveBeenCalled();
    });


    it('should apply request headers set in the interceptor', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var headerSpy = spyOn(XHRConnection.prototype, 'setRequestHeader');
        function interceptor(err, request, next) {
          request.headers['Client'] = 'Browser';
          next();
        }
        http.globalInterceptors.request.push(interceptor);
        http.request(defaultConfig);
        PromiseBackend.flush(true);
        expect(headerSpy).toHaveBeenCalledWith('Client', 'Browser');
      });
    });


    it('should call interceptRequest with the Request object', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var spy = spyOn(http, 'interceptRequest').and.callThrough();
        http.request({method: 'GET', url: '/something'});
        PromiseBackend.flush(true);
        expect(spy).toHaveBeenCalled();
        expect(spy.calls.argsFor(0)[1].method).toBe('GET');
        expect(spy.calls.argsFor(0)[1].url).toBe('/something');
      });

    });


    it('should call interceptResponse with the raw response upon successful request', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var spy = spyOn(http, 'interceptResponse');
        ConnectionMockBackend.whenRequest('GET', '/users').respond(200, 'rawbody');
        http.request({
          method: 'GET',
          url: '/users',
          ConnectionClass: ConnectionMock
        }).then(spy);
        PromiseBackend.flush(true);
        ConnectionMockBackend.flush();
        expect(spy).toHaveBeenCalled();
      });
    });


    it('should call interceptResponse with an error failure', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var spy = spyOn(http, 'interceptResponse');
        ConnectionMockBackend.whenRequest('GET', '/users').respond(404, 'error: not found');
        http.request({
          method: 'GET',
          url: '/users',
          ConnectionClass: ConnectionMock
        });
        PromiseBackend.flush(true);
        ConnectionMockBackend.flush(true);
        expect(spy.calls.argsFor(0)[0]).toBe('error: not found');
      });
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


  describe('.interceptResponse()', function() {
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
      assert.type(http.interceptResponse(undefined, sampleRequest, sampleResponse).then, Function);
    });


    it('should process the response through globalInterceptors', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        http.globalInterceptors.response.push(function(err, req, res, next) {
          res.body = res.body.replace('raw','intercepted');
          next();
        });
        http.interceptResponse(undefined, sampleRequest, {
          body: 'rawbody',
          responseType: 'text',
          responseText: 'rawbody',
          status: 200,
          headers: new Map(),
        }).then(goodSpy);
        PromiseBackend.flush(true);
        expect(goodSpy.calls.argsFor(0)[0].body).toBe('interceptedbody');
        expect(badSpy).not.toHaveBeenCalled();
      });
    });


    it('should call reject if called with an error object', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        var error = {foo: 'bar'};
        http.globalInterceptors.response.push(function(err, req, res, next) {
          res.body = res.body.replace('raw','intercepted');
          next();
        });
        http.interceptResponse(error, sampleRequest, {
          body: 'rawbody',
          responseType: 'text',
          responseText: 'rawbody',
          status: 200,
          headers: new Map(),
        }).then(goodSpy, badSpy);
        PromiseBackend.flush(true);
        expect(badSpy).toHaveBeenCalledWith(error);
        expect(goodSpy).not.toHaveBeenCalled();
      });
    });


    it('should call reject if an error is ever passed to next', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        var error = {foo: 'bar'};
        http.globalInterceptors.response.push(function(err, req, res, next) {
          res.body = res.body.replace('raw','intercepted');
          next(error);
        });
        http.interceptResponse(undefined, sampleRequest, {
          body: 'rawbody',
          responseType: 'text',
          responseText: 'rawbody',
          status: 200,
          headers: new Map(),
        }).then(goodSpy, badSpy);
        PromiseBackend.flush(true);
        expect(badSpy).toHaveBeenCalledWith(error);
        expect(goodSpy).not.toHaveBeenCalled();
      });
    });
  });


  describe('.interceptRequest()', function() {
    var sampleRequest;

    beforeEach(function() {
      sampleRequest = {
        method: 'GET',
        url: '/users',
        headers: new Map(),
        params: new Map(),
        responseType: 'text',
        data: ''
      };
    });

    it('should return a promise', function() {
      assert.type(http.interceptRequest(undefined, sampleRequest).then, Function);
    });


    it('should process the response through globalInterceptors', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        http.globalInterceptors.request.push(function(err, req, next) {
          req.headers.sender = 'Jeff';
          next();
        });
        http.interceptRequest(undefined, sampleRequest).then(goodSpy);
        PromiseBackend.flush(true);
        expect(goodSpy.calls.argsFor(0)[0].headers.sender).toBe('Jeff');
        expect(badSpy).not.toHaveBeenCalled();
      });
    });


    it('should call reject if called with an error object', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        var error = {foo: 'bar'};
        http.globalInterceptors.request.push(function(err, req, next) {
          next();
        });
        http.interceptRequest(error, sampleRequest).then(goodSpy, badSpy);
        PromiseBackend.flush(true);
        expect(badSpy).toHaveBeenCalledWith(error);
        expect(goodSpy).not.toHaveBeenCalled();
      });
    });


    it('should call reject if an error is ever passed to next', function() {
      ConnectionMockBackend.forkZone().run(function() {
        var goodSpy = jasmine.createSpy('goodSpy');
        var badSpy = jasmine.createSpy('badSpy');
        var error = {foo: 'bar'};
        http.globalInterceptors.request.push(function(err, req, next) {
          next(error);
        });
        http.interceptRequest(undefined, sampleRequest).then(goodSpy, badSpy);
        PromiseBackend.flush(true);
        expect(badSpy).toHaveBeenCalledWith(error);
        expect(goodSpy).not.toHaveBeenCalled();
      });
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
