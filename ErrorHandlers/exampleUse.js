import {syncHandler} from './syncHandler.js';

const divide1 = (a,b)=> {
    return a/b ;
};
const divide = syncHandler(function (a,b) {
    if (b === 0) {
        throw new Error("Division by zero is not allowed!");
    }
    ConnectionPoolMonitoringEvent.error()
    return a/b ;
});

console.log(divide1(66,0));
console.log(divide(66,0));