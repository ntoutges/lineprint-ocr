"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.floodFillBounds = exports.floodFillAdd = exports.floodFill = exports.floodFillUntil = void 0;
const jimpable_js_1 = require("./jimpable.js");
const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];
function floodFillUntil(img, x, y, limit) {
    const blacklist = new Set();
    const queue = [[x, y]];
    const width = img.bitmap.width;
    blacklist.add(x + y * width);
    while (queue.length > 0) {
        const [x1, y1] = queue.pop();
        limit--; // account for current pixel
        if (limit <= 0)
            return 0;
        for (const dir of dirs) {
            const wx = x1 + dir[0];
            const wy = y1 + dir[1];
            if (blacklist.has(wx + wy * width))
                continue; // already checked
            blacklist.add(wx + wy * width);
            const val = (0, jimpable_js_1.getPixelAt)(img, wx, wy);
            if (val == 0xFF)
                continue; // not a pixel of interest
            // limit = floodFillUntil(img, wx,wy, limit, blacklist);
            queue.push([wx, wy]);
            // if (limit <= 0) return 0;
        }
    }
    return limit;
}
exports.floodFillUntil = floodFillUntil;
function floodFill(img, x, y) {
    const queue = [[x, y]];
    while (queue.length > 0) {
        const [x1, y1] = queue.pop();
        (0, jimpable_js_1.setPixelAt)(img, x1, y1, 0xff);
        for (const dir of dirs) {
            const wx = x1 + dir[0];
            const wy = y1 + dir[1];
            const val = (0, jimpable_js_1.getPixelAt)(img, wx, wy);
            if (val == 0xFF)
                continue; // not a pixel of interest
            // floodFill(img, wx,wy);
            queue.push([wx, wy]);
        }
    }
}
exports.floodFill = floodFill;
function floodFillAdd(img, x, y, blacklist) {
    const queue = [[x, y]];
    const width = img.bitmap.width;
    blacklist.add(x + y * width);
    while (queue.length > 0) {
        const [x1, y1] = queue.pop();
        for (const dir of dirs) {
            const wx = x1 + dir[0];
            const wy = y1 + dir[1];
            const val = (0, jimpable_js_1.getPixelAt)(img, wx, wy);
            if (val == 0xFF || blacklist.has(wx + width * wy))
                continue; // not a pixel of interest
            blacklist.add(wx + width * wy);
            queue.push([wx, wy]);
        }
    }
}
exports.floodFillAdd = floodFillAdd;
function floodFillBounds(img, x, y) {
    const blacklist = new Set();
    const queue = [[x, y]];
    const width = img.bitmap.width;
    let minX = x;
    let maxX = x;
    let minY = y;
    let maxY = y;
    while (queue.length > 0) {
        const [x1, y1] = queue.pop();
        for (const dir of dirs) {
            const wx = x1 + dir[0];
            const wy = y1 + dir[1];
            const val = (0, jimpable_js_1.getPixelAt)(img, wx, wy);
            if (val == 0xFF || blacklist.has(wx + width * wy))
                continue; // not a pixel of interest
            blacklist.add(wx + width * wy);
            minX = Math.min(minX, wx);
            minY = Math.min(minY, wy);
            maxX = Math.max(maxX, wx);
            maxY = Math.max(maxY, wy);
            queue.push([wx, wy]);
        }
    }
    return {
        x: minX,
        y: minY,
        x2: maxX,
        y2: maxY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
    };
}
exports.floodFillBounds = floodFillBounds;
//# sourceMappingURL=floodable.js.map