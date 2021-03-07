"use strict";

const PROMISE_STATES = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
}
  
function isObject(val) {
  return val && typeof val === 'object'
}

function isPromise(val) {
  return val instanceof MyPromise
}

function nextTick(callback) {
  if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
    process.nextTick(callback)
  } else {
    const observer = new MutationObserver(callback)
    const textNode = document.createTextNode('1')
    observer.observe(textNode, {
      characterData: true
    })
    textNode.data = '2'
  }
}

function transition(promise, targetState, value) {
  if (promise.state === PROMISE_STATES.PENDING && targetState !== PROMISE_STATES.PENDING) {
    Object.defineProperty(promise, 'state', {
      configurable: false,
      writable: false,
      enumerable: true,
      value: targetState
    })
    if (targetState === PROMISE_STATES.FULFILLED) {
      Object.defineProperty(promise, 'value', {
        configurable: false,
        writable: false,
        enumerable: true,
        value
      })
      nextTick(() => {
        promise.fulfillQueue.forEach(({ handler, chainedPromise }) => {
          try {
            if (typeof handler === 'function') {
              const adoptedValue = handler(value)
              resolvePromiseWithValue(chainedPromise, adoptedValue)
            } else {
              transition(chainedPromise, PROMISE_STATES.FULFILLED, promise.value)
            }
          } catch (error) {
            transition(chainedPromise, PROMISE_STATES.REJECTED, error)
          }
        })
        promise.fulfillQueue = [];
      })
    } else if (targetState === PROMISE_STATES.REJECTED) {
      Object.defineProperty(promise, 'reason', {
        configurable: false,
        writable: false,
        enumerable: true,
        value
      })
      nextTick(() => {
        promise.rejectQueue.forEach(({ handler, chainedPromise }) => {
          try {
            if (typeof handler === 'function') {
              const adoptedValue = handler(value)
              resolvePromiseWithValue(chainedPromise, adoptedValue)
            } else {
              transition(chainedPromise, PROMISE_STATES.REJECTED, promise.reason)
            }
          } catch (error) {
            transition(chainedPromise, PROMISE_STATES.REJECTED, error)
          }
        })
        promise.rejectQueue = [];
      })
    }
  }
}

function resolvePromiseWithValue(promise, x, thenableValues = []) {
  if (promise === x) {
    transition(promise, PROMISE_STATES.REJECTED, new TypeError('promise and x cannot refer to the same object.'))
  } else if (isPromise(x)) {
    if (x.state !== PROMISE_STATES.PENDING) {
      transition(promise, x.state, x.state === PROMISE_STATES.FULFILLED ? x.value : x.reason)
    } else {
      x.then(value => {
        resolvePromiseWithValue(promise, value, thenableValues)
      }, reason => {
        transition(promise, PROMISE_STATES.REJECTED, reason)
      })
    }
  } else if (isObject(x) || typeof x === 'function') {
    let isInvoked = false;
    try {
      const then = x.then;
      if (typeof then === 'function' ) {
        then.call(x, value => {
          if (thenableValues.indexOf(value) !== -1) {
            transition(promise, PROMISE_STATES.REJECTED, new TypeError('there is a thenable cycle that will lead to infinite recursion.'))
          }
          if (!isInvoked) {
            thenableValues.push(value)
            resolvePromiseWithValue(promise, value, thenableValues)
            isInvoked = true;
          }
        }, reason => {
          if (!isInvoked) {
            transition(promise, PROMISE_STATES.REJECTED, reason)
            isInvoked = true;
          }
        })
      } else {
        transition(promise, PROMISE_STATES.FULFILLED, x)
      }
    } catch (error) {
      if (!isInvoked) {
        transition(promise, PROMISE_STATES.REJECTED, error)
      }
    }
  } else {
    transition(promise, PROMISE_STATES.FULFILLED, x)
  }
}

function resolve(value) {
  resolvePromiseWithValue(this, value)
}

function reject(reason) {
  transition(this, PROMISE_STATES.REJECTED, reason)
}

class MyPromise {
  constructor(executor) {
    this.state = PROMISE_STATES.PENDING;
    this.fulfillQueue = [];
    this.rejectQueue = [];

    executor(resolve.bind(this), reject.bind(this))
  }
  
  then(onFulfilled, onRejected) {
    const promise2 = new MyPromise(() => {})
    if (this.state === PROMISE_STATES.FULFILLED) {
      nextTick(() => {
        try {
          if (typeof onFulfilled === 'function') {
            const adoptedValue = onFulfilled(this.value)
            resolvePromiseWithValue(promise2, adoptedValue)
          } else {
            transition(promise2, PROMISE_STATES.FULFILLED, this.value)
          }
        } catch (error) {
          transition(promise2, PROMISE_STATES.REJECTED, error)
        }
      })
    } else if (this.state === PROMISE_STATES.REJECTED) {
      nextTick(() => {
        try {
          if (typeof onRejected === 'function') {
            const adoptedValue = onRejected(this.reason)
            resolvePromiseWithValue(promise2, adoptedValue)
          } else {
            transition(promise2, PROMISE_STATES.REJECTED, this.reason)
          }
        } catch (error) {
          transition(promise2, PROMISE_STATES.REJECTED, error)
        }
      })
    } else {
      this.fulfillQueue.push({
        handler: onFulfilled,
        chainedPromise: promise2
      })

      this.rejectQueue.push({
        handler: onRejected,
        chainedPromise: promise2
      })
    }
    return promise2;
  }
}

MyPromise.resolve = function(x) {
  return new MyPromise((resolve) => {
    resolve(x)
  })
}

MyPromise.reject = function(reason) {
  return new MyPromise((resolve, reject) => {
    reject(reason)
  })
}

module.exports = {
  resolved: function (value) {
    return new MyPromise(function (resolve) {
      resolve(value);
    });
  },
  rejected: function (reason) {
    return new MyPromise(function (resolve, reject) {
      reject(reason);
    });
  },
  deferred: function () {
    var resolve, reject;
    return {
      promise: new MyPromise(function (rslv, rjct) {
        resolve = rslv;
        reject = rjct;
      }),
      resolve: resolve,
      reject: reject
    };
  }
}