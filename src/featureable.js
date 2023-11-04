"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leftFlatness = void 0;
const jimpable_js_1 = require("./jimpable.js");
function leftFlatness(img, smoothing = 5) {
    let firstPx = [];
    for (let y = 0; y < img.bitmap.height; y++) {
        let firstPxVal = -1;
        for (let x = 0; x < img.bitmap.width; x++) {
            if ((0, jimpable_js_1.getPixelAt)(img, x, y) != 0xFF) {
                firstPxVal = x;
                break;
            }
        }
        if (firstPxVal != -1)
            firstPx.push(firstPxVal);
    }
    firstPx.sort((a, b) => a - b);
    const end = firstPx.length - 1;
    // return median of mins minus median of maxes
    return median(firstPx.slice(end - smoothing, end)) - median(firstPx.slice(0, smoothing));
}
exports.leftFlatness = leftFlatness;
function stdev(vals) {
    const avg = average(vals);
    return Math.sqrt(sum(vals, (val) => { return (val - avg) ** 2; }) / (vals.length - 1));
}
function average(vals) {
    return sum(vals) / vals.length;
}
function sum(vals, map = (val) => val) {
    let total = 0;
    for (const val of vals) {
        total += map(val);
    }
    return total;
}
function median(val) {
    val.sort();
    if (val.length % 2 == 0)
        return (val[val.length / 2] + val[(val.length / 2 - 1)]) / 2;
    return val[(val.length - 1) / 2];
}
//# sourceMappingURL=featureable.js.map