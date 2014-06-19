import {Inject} from 'di/annotations';
import {Injector} from 'di/injector';
import {Deferred} from 'prophecy/Deferred';
import {assert} from 'assert';

var jsonpCallback = 0;
var nextCallback = () => {
  var id = `__${++jsonpCallback}`;
  var cbdata;
  if (!window.__ngHttp__) window.__ngHttp__ = {};
  if (!window.__ngHttp__.jsonp) window.__ngHttp__.jsonp = {};
  cbdata = window.__ngHttp__.jsonp[id] = (data) => {
    cbdata.called = true;
    cbdata.data = data;
    return;
  };
  cbdata.id = id;
  cbdata.called = false;
  return cbdata;
};

var deleteCallback = (cbdata) => {
  var id = cbdata.id;
  if (window.__ngHttp__.jsonp[id] === cbdata) {
    cbdata.data = undefined;
    window.__ngHttp__.jsonp[id] = undefined;
  }
};

/**
 * Manages state of a single connection
 */
export class JSONPConnection {
  constructor() {
    this.callback_ = nextCallback();
    this.script_ = document.createElement('script');
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
    if (this.script_) {
      if (this.script_.parentNode) {
        document.body.removeChild(this.script_);
      }
      this.script_ = null;
    }
    if (this.callback_.called) {
      this.deferred.resolve(this.callback_.data);
    } else {
      // JSONP callback was never called.
      this.deferred.reject();
    }
    this.callback_ = deleteCallback(this.callback_);
  }

  /**
   * Called when something goes horribly wrong with the request
   */
  onError_ (evt:Object) {
    if (this.script_) {
      if (this.script_.parentNode) {
        document.body.removeChild(this.script_);
      }
      this.script_ = null;
    }
    this.deferred.reject(evt);
    this.callback_ = deleteCallback(this.callback_);
  }

  open (url:string) {
    if (!this.script_ || this.script_.src || !this.callback_) {
      throw new Error('Connection is already open');
    }
    url = url.replace('JSON_CALLBACK', `__ngHttp__.jsonp.${this.callback_.id}`);
    this.method = 'GET';
    this.script_.async = true;
    this.script_.src = this.url = url;
  }

  send (data) {
    this.script_.addEventListener('load', (event) => this.onLoad_(event));
    this.script_.addEventListener('error', (event) => this.onError_(event));
    document.body.appendChild(this.script_);
  }
}
