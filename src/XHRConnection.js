import {Inject} from 'di/annotations';
import {Injector} from 'di/injector';
import {Deferred} from 'prophecy/Deferred';
import {assert} from 'assert';

var XHRDataTypes = assert.define('XHRDataTypes', (value) => {
  if (value instanceof Document) {
    //pass
    //related to issue https://github.com/angular/assert/issues/5
  }
  else {
    assert(value).is(DataView, Blob, Document, assert.string, FormData);
  }
});

/**
 * Manages state of a single connection
 */
export class XHRConnection {
  constructor() {
    this.xhr_ = new XMLHttpRequest();
    this.deferred = new Deferred();
    this.promise = this.deferred.promise;
  }

  then (resolve, reject) {
    this.promise.then(resolve, reject);
    return this;
  }

  success (callback) {
    this.promise.then(callback);
  }

  error(callback) {
    this.promise.then(null, callback);
  }

  /**
   * Called when the request transfer is completed, regardless of the status of
   * the response.
   */
  //TODO (jeffbcross): analyze status and handle problems
  onLoad_ (evt:Object) {
    this.xhr_.removeEventListener('load', this.onLoad_);
    this.xhr_.removeEventListener('error', this.onError_);
    this.deferred.resolve(this.xhr_.responseText);
  }

  /**
   * Called when something goes horribly wrong with the request
   */
  onError_ (evt:Object) {
    this.xhr_.removeEventListener('load', this.onLoad_);
    this.xhr_.removeEventListener('error', this.onError_);
    this.deferred.reject(evt);
  }

  open (method:string, url:string) {
    if (this.xhr_.readyState === 1) {
      throw new Error('Connection is already open');
    }
    this.method = method;
    this.url = url;
    this.xhr_.open(this.method, this.url);
  }

  setRequestHeader (key:string, value:string) {
    this.xhr_.setRequestHeader(key, value);
  }

  send (data) {
    this.xhr_.addEventListener('load', this.onLoad_.bind(this));
    this.xhr_.addEventListener('error', this.onError_.bind(this));
    if (typeof data !== 'undefined') {
      assert.type(data, XHRDataTypes);
    }

    this.xhr_.send(data);
  }
}
