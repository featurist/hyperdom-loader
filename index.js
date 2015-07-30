var h = require('plastiq').html;

module.exports = function(fn, options) {
  var storedValue;
  var storedException;
  var callId = 0;
  var previousPromise;
  var resetTimeout;
  var timeout = options && options.hasOwnProperty('timeout')? options.timeout: 140;
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
            storedValue = value;

            if (onfulfilled) {
              onfulfilled(value);
            }
          }
          if (resetTimeout) {
            clearTimeout(resetTimeout);
          }
        }, function (error) {
          if (thisCallId == callId) {
            storedException = error;
          }
          if (resetTimeout) {
            clearTimeout(resetTimeout);
          }
        });

        if (timeout) {
          if (resetTimeout) {
            clearTimeout(resetTimeout);
          }
          resetTimeout = setTimeout(function () {
            storedValue = undefined;
          }, timeout);
        } else {
          storedValue = undefined;
        }

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

  return function () {
    setPlastiqRefresh();

    throttledFn.apply(this, arguments);

    if (storedException) {
      throw storedException;
    } else {
      return storedValue;
    }
  };
};

function onlyWithDifferentArguments(fn, options) {
  var lastArguments;

  if (options && options.equality == 'json') {
    return function () {
      if (!lastArguments || !argumentsEqualJson(lastArguments, arguments)) {
        fn.apply(this, arguments);

        lastArguments = new Array(arguments.length);
        for (var n = 0; n < lastArguments.length; n++) {
          lastArguments[n] = JSON.stringify(arguments[n]);
        }
      }
    };
  } else {
    return function () {
      if (!lastArguments || !argumentsEqual(lastArguments, arguments)) {
        fn.apply(this, arguments);

        lastArguments = new Array(arguments.length);
        for (var n = 0; n < lastArguments.length; n++) {
          lastArguments[n] = arguments[n];
        }
      }
    };
  }
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

