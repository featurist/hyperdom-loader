var expect = require('chai').expect;
var loader = require('..');

describe('loader', function () {
  context('when the function returns a promise', function () {
    it('eventually loads value', function () {
      var promise;

      function fn(value) {
        promise = eventualValue(value);
        return promise;
      }

      var l = loader(fn);

      expect(l('value')).to.be.undefined;

      return promise.then(function () {
        expect(l('value')).to.equal('value');
      });
    });

    it('only calls the function once when the same arguments are used', function () {
      var calls = 0;

      function fn(value) {
        calls++;
      }

      var l = loader(fn);

      l('value');
      l('value');

      expect(calls).to.equal(1);
    });

    it('can be reloaded with reset()', function () {
      var calls = 0;

      function fn(value) {
        calls++;
      }

      var l = loader(fn);

      l('value');
      l('value');

      expect(calls).to.equal(1);

      l.reset();
      l('value');
      l('value');

      expect(calls).to.equal(2);
    });

    it('calls the function again if the arguments are different from last time', function () {
      var calls = 0;

      function fn(value) {
        calls++;
      }

      var l = loader(fn);

      l('value');
      l('value');
      expect(calls).to.equal(1);

      l('diff value');
      l('diff value');
      expect(calls).to.equal(2);

      l('value');
      l('value');
      expect(calls).to.equal(3);
    });

    it('always returns the result for the last call, even if the earlier call takes longer', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualValue(value, n);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn);

      expect(l('value 1', 100)).to.be.undefined;
      expect(l('value 2', 10)).to.be.undefined;

      return Promise.all(promises).then(function () {
        expect(l('value 2', 10)).to.equal('value 2');
      });
    });

    it('aborts the previous promise', function () {
      var promises = [];
      var aborts = [];

      function fn(value, n) {
        var promise = eventualValue(value, n);
        promises.push(promise);

        promise.abort = function () {
          aborts.push(value);
        };

        return promise;
      }

      var l = loader(fn);

      expect(l('value 1', 100)).to.be.undefined;
      expect(l('value 2', 10)).to.be.undefined;

      return promises[1].then(function () {
        expect(l('value 2', 10)).to.equal('value 2');
        expect(aborts).to.eql(['value 1']);
      });
    });

    it('continues to return previous value while new value is loading', function () {
      var promises = [];

      function fn(value) {
        var promise = eventualValue(value, 20);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn);

      l('value 1');

      return promises[0].then(function () {
        expect(l('value 1')).to.equal('value 1');
        expect(l('value 2')).to.equal('value 1');

        return promises[1].then(function () {
          expect(l('value 2')).to.equal('value 2');
        });
      });
    });

    it('returns undefined after timeout', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualValue(value, n);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn, {timeout: 140});

      l('value 1', 20);

      return promises[0].then(function () {
        expect(l('value 1', 20)).to.equal('value 1');
        expect(l('value 2', 300)).to.equal('value 1');
      }).then(function () {
        return wait(200);
      }).then(function () {
        expect(l('value 2', 300)).to.be.undefined;
        return promises[1].then(function () {
          expect(l('value 2', 300)).to.equal('value 2');
        });
      });
    });

    it('returns undefined immediately if timeout is 0', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualValue(value, n);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn, {timeout: 0});

      l('value 1', 20);

      return promises[0].then(function () {
        expect(l('value 1', 20)).to.equal('value 1');
        expect(l('value 2', 300)).to.be.undefined;
      }).then(function () {
        return wait(200);
      }).then(function () {
        expect(l('value 2', 300)).to.be.undefined;
        return promises[1].then(function () {
          expect(l('value 2', 300)).to.equal('value 2');
        });
      });
    });

    it('continues to return the last value after the timeout', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualValue(value, n);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn, {timeout: 140});

      l('value 1', 20);
      l('value 2', 20);
      l('value 3', 20);
      l('value 4', 20);

      return wait(300).then(function () {
        expect(l('value 4', 20)).to.equal('value 4');
      });
    });

    describe('calling onfulfilled', function () {
      it('calls onfulfilled when a promise is fulfilled', function () {
        var promise;
        var fulfilled = false;

        function fn(value) {
          promise = eventualValue(value);
          return promise;
        }

        var l = loader(fn, {onfulfilled: function (value) {
          fulfilled = value;
        }});

        expect(l('value')).to.be.undefined;
        expect(fulfilled).to.be.false;

        return promise.then(function () {
          expect(l('value')).to.equal('value');
          expect(fulfilled).to.equal('value');
        });
      });

      it('calls onfulfilled when a promise is rejected', function () {
        var promise;
        var fulfilled = false;

        function fn(value) {
          promise = eventualException(value);
          return promise;
        }

        var l = loader(fn, {onfulfilled: function (value) {
          fulfilled = value;
        }});

        expect(l('error')).to.be.undefined;
        expect(fulfilled).to.be.false;

        return promise.then(undefined, function () {
          expect(function () { l('error') }).to.throw('error');
          expect(fulfilled).to.exist;
          expect(fulfilled.message).to.equal('error');
        });
      });

      it('only calls onfulfilled if its the result of the most recent call', function () {
        var promises = [];
        var fulfilled = [];

        function fn(value, n) {
          var promise = eventualValue(value, n);
          promises.push(promise);
          return promise;
        }

        var l = loader(fn, {onfulfilled: function (value) {
          fulfilled.push(value);
        }});

        expect(l('value1', 100)).to.be.undefined;
        expect(l('value2', 20)).to.be.undefined;

        return Promise.all(promises).then(function () {
          expect(l('value2', 20)).to.equal('value2');
          expect(fulfilled).to.eql(['value2']);
        });
      });
    });
  });

  context('when the function returns a rejected promise', function () {
    it('eventually throws exception', function () {
      var promise;

      function fn(value) {
        promise = eventualException(value);
        return promise;
      }

      var l = loader(fn);

      expect(l('value')).to.be.undefined;

      return promise.then(undefined, function () {
        expect(function () { l('value'); }).to.throw('value');
      });
    });

    it('returns undefined on new arguments, even if the last call threw an exception', function () {
      var rejectedPromise, fulfilledPromise;

      function fn(value) {
        if (value) {
          return fulfilledPromise = eventualValue(value);
        } else {
          return rejectedPromise = eventualException();
        }
      }

      var l = loader(fn);

      expect(l(false)).to.be.undefined;

      return rejectedPromise.then(undefined, function () {
        expect(function () { l(false); }).to.throw(Error);
        expect(l('value')).to.be.undefined;

        return fulfilledPromise.then(function () {
          expect(l('value')).to.equal('value');
        });
      });
    });

    it('always throws the the last exception, even if the earlier call takes longer and throws an exception', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualException(value, n);
        promises.push(promise.then(undefined, function () {}));
        return promise;
      }

      var l = loader(fn);

      expect(l('value 1', 100)).to.be.undefined;
      expect(l('value 2', 10)).to.be.undefined;

      return Promise.all(promises).then(function () {
        expect(function () { l('value 2', 10); }).to.throw('value 2');
      });
    });

    it('continues to throw the last exception after the timeout', function () {
      var promises = [];

      function fn(value, n) {
        var promise = eventualException(value, n);
        promises.push(promise);
        return promise;
      }

      var l = loader(fn, {timeout: 140});

      l('value 1', 20);

      return wait(300).then(function () {
        expect(function () { l('value 1', 20); }).to.throw('value 1');
      });
    });
  });

  context('when returning a value', function() {
    it('returns the value', function () {
      function fn(value) {
        return value;
      }

      var l = loader(fn);

      expect(l('value')).to.equal('value');
    });

    it('continues to return the value, even if an earlier call returned a promise', function () {
      var promise;

      function fn(value) {
        if (value) {
          promise = eventualValue(value);
          return promise;
        } else {
          return value;
        }
      }

      var l = loader(fn);

      l(true);
      expect(l(false)).to.equal(false);

      return promise.then(function () {
        expect(l(false)).to.equal(false);
      });
    });

    it('only calls the function once when the same arguments are used', function () {
      var calls = 0;

      function fn(value) {
        calls++;
      }

      var l = loader(fn);

      l('value');
      l('value');

      expect(calls).to.equal(1);
    });

    it('calls the function again if the arguments are different from last time', function () {
      var calls = 0;

      function fn(value) {
        calls++;
      }

      var l = loader(fn);

      l('value');
      l('value');
      expect(calls).to.equal(1);

      l('diff value');
      l('diff value');
      expect(calls).to.equal(2);

      l('value');
      l('value');
      expect(calls).to.equal(3);
    });
  });

  context('when throwing an exception', function() {
    it('throws the exception on each call', function () {
      function fn(value) {
        throw new Error(value);
      }

      var l = loader(fn);

      expect(function () { l('value'); }).to.throw('value');
      expect(function () { l('value'); }).to.throw('value');
    });

    it('returns a value even if the last call was an exception', function () {
      function fn(value) {
        if (value) {
          return value;
        } else {
          throw new Error(value);
        }
      }

      var l = loader(fn);

      expect(function () { l(false); }).to.throw(Error);
      expect(l('value')).to.equal('value');
    });

    it('continues to throw the exception, even if an earlier call returned a promise', function () {
      var promise;

      function fn(value) {
        if (value) {
          promise = eventualValue(value);
          return promise;
        } else {
          throw new Error('error');
        }
      }

      var l = loader(fn);

      l(true);
      expect(function () { l(false); }).to.throw(Error);

      return promise.then(function () {
        expect(function () { l(false); }).to.throw(Error);
      });
    });

    it('only calls the function once when the same arguments are used', function () {
      var calls = 0;

      function fn(value) {
        calls++;
        throw new Error(value);
      }

      var l = loader(fn);

      expect(function () { l('value'); }).to.throw('value');
      expect(function () { l('value'); }).to.throw('value');

      expect(calls).to.equal(1);
    });

    it('calls the function again if the arguments are different from last time', function () {
      var calls = 0;

      function fn(value) {
        calls++;
        throw new Error(value);
      }

      var l = loader(fn);

      expect(function () { l('value1'); }).to.throw('value1');
      expect(function () { l('value1'); }).to.throw('value1');
      expect(calls).to.equal(1);

      expect(function () { l('value2'); }).to.throw('value2');
      expect(function () { l('value2'); }).to.throw('value2');
      expect(calls).to.equal(2);

      expect(function () { l('value1'); }).to.throw('value1');
      expect(function () { l('value1'); }).to.throw('value1');
      expect(calls).to.equal(3);
    });
  });

  describe('comparison', function () {
    describe('json', function () {
      it('calls the function only once if the arguments produce the same JSON', function () {
        var calls = 0;

        var fn = loader(function (obj) {
          calls++;
          return obj;
        }, {equality: 'json'});

        fn({a: 1});
        fn({a: 1});

        expect(calls).to.equal(1);
      });

      it('calls the function again if the same object has changed', function () {
        var calls = 0;

        var fn = loader(function (obj) {
          calls++;
          return obj;
        }, {equality: 'json'});

        var obj = {a: 1};
        fn(obj);
        fn(obj);
        expect(calls).to.equal(1);

        obj.a = 2;
        fn(obj);
        fn(obj);
        expect(calls).to.equal(2);
      });
    });

    it('only calls once if called with no arguments twice', function () {
      var calls = 0;
      var fn = loader(function () {
        calls++;
      });

      fn();
      fn();

      expect(calls).to.equal(1);
    });
  });
});

function wait(n) {
  return new Promise(function (fulfil) {
    setTimeout(fulfil, n);
  });
}

function eventualValue(value, n) {
  return new Promise(function (fulfil) {
    setTimeout(function () {
      fulfil(value);
    }, n || 20);
  });
}

function eventualException(value, n) {
  return new Promise(function (fulfil, reject) {
    setTimeout(function () {
      reject(new Error(value));
    }, n || 20);
  });
}
