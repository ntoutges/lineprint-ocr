"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lap = exports.checkTime = exports.startTimer = void 0;
let start = 0;
function startTimer() {
    start = (new Date()).getTime();
}
exports.startTimer = startTimer;
function checkTime() {
    const now = (new Date()).getTime();
    return now - start;
}
exports.checkTime = checkTime;
function lap() {
    const now = (new Date()).getTime();
    const diff = now - start;
    start = now;
    return diff;
}
exports.lap = lap;
//# sourceMappingURL=timer.js.map