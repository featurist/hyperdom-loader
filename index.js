var h = require('plastiq').html;

module.exports = function(fn, options) {
  var isLoading;
  var loadingSince;
  var storedValue;
  var storedException;
  var callId = 0;
  var previousPromise;
  var resetTimeout;
  var timeout = options && options.hasOwnProperty('timeout')? options.timeout: 140;

  var loading = typeof options == 'object' && options.hasOwnProperty('loading')? options.loading: function (lastValue, loadingSince, isException) {
    if (isException) {
      throw lastValue;
    } else if (loadingSince < timeout) {
      return lastValue;
    }
  };

  var onfulfilled = options && options.onfulfilled;

  function setPlastiqRefresh() {
    if (!onfulfilled && h.currentRender) {
      onfulfilled = h.refresh;
    }
  }

  var throttledFn = onlyWithDifferentArguments(function () {
    var thisCallId = ++callId;
    try {
      var result = fn.apply(this, arguments)
      storedException = undefined;
      
      if(result && typeof result.then === 'function') {
        result.then(function (value) {
          if (thisCallId == callId) {
            isLoading = false;
            storedValue = value;

            if (onfulfilled) {
              onfulfilled(value);
            }
          }
        }, function (error) {
          if (thisCallId == callId) {
            isLoading = false;
            storedException = error;

            if (onfulfilled) {
              onfulfilled(error);
            }
          }
        });

        isLoading = true;
        loadingSince = Date.now();

        if (previousPromise && typeof previousPromise.abort === 'function') {
          previousPromise.abort();
        }

        previousPromise = result;
      } else {
        storedValue = result;
      }
    } catch (error) {
      storedException = error;
    }
  }, options);

  function loader() {
    setPlastiqRefresh();

    throttledFn.apply(this, arguments);

    if (storedException) {
      if (isLoading && loading) {
        return loading(storedException, Date.now() - loadingSince, true);
      } else {
        throw storedException;
      }
    } else {
      if (isLoading && loading) {
        return loading(storedValue, Date.now() - loadingSince, false);
      } else {
        return storedValue;
      }
    }
  };

  loader.reset = throttledFn.reset;

  return loader;
};

function onlyWithDifferentArguments(fn, options) {
  var lastArguments;

  var throttleFn;

  if (options && options.equality == 'json') {
    var throttleFn = function () {
      if (!lastArguments || !argumentsEqualJson(lastArguments, arguments)) {
        fn.apply(this, arguments);

        lastArguments = new Array(arguments.length);
        for (var n = 0; n < lastArguments.length; n++) {
          lastArguments[n] = JSON.stringify(arguments[n]);
        }
      }
    };
  } else {
    var throttleFn = function () {
      if (!lastArguments || !argumentsEqual(lastArguments, arguments)) {
        fn.apply(this, arguments);

        lastArguments = new Array(arguments.length);
        for (var n = 0; n < lastArguments.length; n++) {
          lastArguments[n] = arguments[n];
        }
      }
    };
  }

  throttleFn.reset = function () {
    lastArguments = undefined;
  };

  return throttleFn;
}

function argumentsEqual(args1, args2, equality) {
  if (args1.length !== args2.length) {
    return false;
  } else {
    for(var n = 0; n < args1.length; n++) {
      if (args1[n] !== args2[n]) {
        return false;
      }
    }

    return true;
  }
}

function argumentsEqualJson(args1, args2) {
  if (args1.length !== args2.length) {
    return false;
  } else {
    for(var n = 0; n < args1.length; n++) {
      if (args1[n] !== JSON.stringify(args2[n])) {
        return false;
      }
    }

    return true;
  }
}

