# promises-aplus-robin

<a href="https://promisesaplus.com/">
    <img src="https://promisesaplus.com/assets/logo-small.png" alt="Promises/A+ logo" title="Promises/A+ 1.0 compliant" align="right" />
</a>

<a href="https://github.com/cumt-robin/promises-aplus-robin">promises-aplus-robin</a> is a lightweight Promises/A+ implementation that is able to detect circular thenable chain. Except for the features defined in the Promises/A+ Standard, more features can be found in the extended version.

## Supported Features

- [x] Promise/A+ standard
- [x] detecting thenable cycle
- [x] `MyPromise.prototype.catch`
- [x] `MyPromise.prototype.finally`
- [x] `MyPromise.resolve`
- [x] `MyPromise.reject`
- [x] `MyPromise.all`
- [ ] `MyPromise.race`
- [ ] ......

## Versions

- raw version: [promises-aplus-robin.js](https://github.com/cumt-robin/promises-aplus-robin/blob/main/promises-aplus-robin.js)
- annotated version: [promises-aplus-robin-annotated.js](https://github.com/cumt-robin/promises-aplus-robin/blob/main/promises-aplus-robin-annotated.js)
- extended version: [promises-aplus-robin-extended.js](https://github.com/cumt-robin/promises-aplus-robin/blob/main/promises-aplus-robin-extended.js)
- hack version: [promises-aplus-robin-hack.js](https://github.com/cumt-robin/promises-aplus-robin/blob/main/promises-aplus-robin-hack.js)

The **extended version** is used for supporting some features that is excluded in Promises/A+ standard but can be found in modern browsers.

The **hack version** is used for adapting the following case. The explanation can be found at [我以为我很懂Promise，直到我开始实现Promise/A+规范](https://juejin.cn/post/6937076967283884040#heading-17).

```javascript
Promise.resolve().then(() => {
    console.log(0);
    return Promise.resolve(4);
}).then((res) => {
    console.log(res)
})

Promise.resolve().then(() => {
    console.log(1);
}).then(() => {
    console.log(2);
}).then(() => {
    console.log(3);
}).then(() => {
    console.log(5);
}).then(() =>{
    console.log(6);
})
```

## Testing

The implementation of Promise/A+ can be tested by [promises-tests](https://github.com/promises-aplus/promises-tests).

```
npm run test
```