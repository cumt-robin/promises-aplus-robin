"use strict";

/**
 * https://promisesaplus.com
 * Promise的核心是thenable和链式调用，所以专注于实现Promise.prototype.then即可，其他的原型方法和静态方法是锦上添花。
 * 一步一步实现，可以用promises-aplus-tests做测试
 */

// Promise的三种状态
const PROMISE_STATES = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
}

/**
 * 判断目标是否是一个对象
 * @param {*} val 待判断的目标
 */
function isObject(val) {
  return val && typeof val === 'object'
}

/**
 * 按照3.4的解释，只有x完全符合当前Promise/A+实现时，才认定x是一个Promise实例
 * 所以这里直接用instanceof判断实例关系
 * @param {*} val 待判断的目标
 */
function isPromise(val) {
  return val instanceof MyPromise
}

/**
 * Promise的回调必须在执行上下文栈只包含platform code（所谓的platform code就是指js引擎，宿主环境，Promise实现等代码）时执行，
 * 所以可以用微任务microtask实现（假设用宏任务macrotask实现，浏览器可能已经经过了一轮渲染，不能满足在Promise决议后需要马上操作DOM的场景），
 * 这里用process.nextTick和MutationObserver来实现一个兼容Node和浏览器的nextTick。
 * @param {Function} callback
 */
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

/**
 * 封装Promise状态转移的过程
 * @param {MyPromise} promise 发生状态转移的Promise实例
 * @param {*} targetState 目标状态
 * @param {*} value 伴随状态转移的值，可能是fulfilled的值，也可能是rejected的原因
 */
function transition(promise, targetState, value) {
  if (promise.state === PROMISE_STATES.PENDING && targetState !== PROMISE_STATES.PENDING) {
    // 2.1
    // state只能由pending转为其他态，状态转移后，state和value的值不再变化
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
      // 2.2.4
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
        // 清空queue
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
        // 清空queue
        promise.rejectQueue = [];
      })
    }
  }
}

/**
 * Promise决议过程
 * @param {MyPromise} promise 待决议的Promise实例
 * @param {*} x 决议使用的值
 * @param {Array} thenableValues thenable值的数组，用于检测是否出现thenable cycle
 */
function resolvePromiseWithValue(promise, x, thenableValues = []) {
  if (promise === x) {
    // 2.3.1
    // 由于Promise采纳状态的机制，这里必须进行全等判断，防止出现死循环
    transition(promise, PROMISE_STATES.REJECTED, new TypeError('promise and x cannot refer to the same object.'))
  } else if (isPromise(x)) {
    // 2.3.2
    // 如果x是一个Promise实例，则跟踪并采纳其状态
    if (x.state !== PROMISE_STATES.PENDING) {
      // 假设x的状态已经发生转移，则直接采纳其状态
      transition(promise, x.state, x.state === PROMISE_STATES.FULFILLED ? x.value : x.reason)
    } else {
      // 假设x的状态还是pending，则只需等待x决议后再进行promise的状态转移
      // 而x决议的结果是不定的，所以两种情况我们都需要进行观察
      // 这里用一个.then很巧妙地完成了观察动作
      x.then(value => {
        // x决议为fulfilled，由于callback传过来的value是不确定的类型，所以需要递归求取状态
        resolvePromiseWithValue(promise, value, thenableValues)
      }, reason => {
        // x决议为rejected
        transition(promise, PROMISE_STATES.REJECTED, reason)
      })
    }
  } else if (isObject(x) || typeof x === 'function') {
    // 2.3.3
    // 如果x是一个对象或函数，则要考虑x是否满足thenable机制
    // isInvoked用来保证只执行一次，用以满足2.3.3.3.3和2.3.3.3.4
    let isInvoked = false;
    try {
      // 2.3.3.1
      const then = x.then;
      if (typeof then === 'function' ) {
        // 如果then是一个函数，按thenable机制走一遍
        // 2.3.3.3 x作为调用then的this
        then.call(x, value => {
          // 传给then的第一个参数即rejectPromise被调用
          // 3.6 如果thenable出现了环，状态转为rejected，reason为TypeError
          if (thenableValues.indexOf(value) !== -1) {
            transition(promise, PROMISE_STATES.REJECTED, new TypeError('there is a thenable cycle that will lead to infinite recursion.'))
          }
          if (!isInvoked) {
            // 2.3.3.3.1
            thenableValues.push(value)
            resolvePromiseWithValue(promise, value, thenableValues)
            isInvoked = true;
          }
        }, reason => {
          // 传给then的第一个参数即resolvePromise被调用
          if (!isInvoked) {
            // 2.3.3.3.2
            transition(promise, PROMISE_STATES.REJECTED, reason)
            isInvoked = true;
          }
        })
      } else {
        // 2.3.3.4
        // 否则promise直接采纳x的值，状态转移为fulfilled
        transition(promise, PROMISE_STATES.FULFILLED, x)
      }
    } catch (error) {
      if (!isInvoked) {
        // 2.3.3.2 & 2.3.3.3.4 在这里一起捕获
        transition(promise, PROMISE_STATES.REJECTED, error)
      }
    }
  } else {
    // 2.3.4
    // 否则x是一个普通值，则promise直接采纳x的值，状态转移为fulfilled
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
    this.state = PROMISE_STATES.PENDING; // 'pending', 'fulfilled', 'rejected'
    // value和reason默认是undefined，这里先不赋值
    this.fulfillQueue = [];
    this.rejectQueue = [];
    // 构造Promise实例后，立刻调用executor
    executor(resolve.bind(this), reject.bind(this))
  }
  
  then(onFulfilled, onRejected) {
    // 需要返回一个新的Promise实例，供链式调用
    const promise2 = new MyPromise(() => {})

    if (this.state === PROMISE_STATES.FULFILLED) {
      // 已经是fulfilled了，nextTick进入新Promise的决议程序
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
      // 已经是rejected了，nextTick进入新Promise的决议程序
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
      // 否则进入到待执行队列中
      this.fulfillQueue.push({
        handler: onFulfilled,
        chainedPromise: promise2
      })

      this.rejectQueue.push({
        handler: onRejected,
        chainedPromise: promise2
      })
    }
    // 返回它
    return promise2;
  }
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