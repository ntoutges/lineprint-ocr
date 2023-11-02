"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAverageCharBounds = exports.getTopLeftCharBounds = exports.getLineCharBounds = exports.getTopLine = exports.getLineFirstCharBounds = void 0;
const floodable_js_1 = require("./floodable.js");
const settings_js_1 = require("./settings.js");
const jimpable_js_1 = require("./jimpable.js");
// export function getCharBounds(img: Jimp) {
//   const scanlines = getSetting<number>("charBounds.scanlines");
//   const boundsList: Bounds[][] = [];
//   let minY = 0;
//   const maxY = img.bitmap.height;
//   // while loop, but with built-in max itteration count
//   for (let i = 0; i < 200; i++) {
//     const line = getTopLine(img, minY);
//     if (line >= maxY) break; // no other black pixels available
//     const localBoundsList = getLineCharBounds(img, line,line + scanlines);
//     localBoundsList.forEach(bounds => { // search for max-y value for use in next itteration
//       minY = Math.max(minY, bounds.y2+1);
//     });
//     boundsList.push(localBoundsList);
//   }
//   return boundsList;
// }
function getLineFirstCharBounds(img, avgCharBounds) {
    // const scanlines = getSetting<number>("charBounds.scanlines");
    const lookaround = (0, settings_js_1.getSetting)("charBounds.lookaround.vertical");
    const boundsList = [];
    let minY = 20;
    const maxY = img.bitmap.height;
    const maxX = img.bitmap.width;
    // while loop, but with built-in max itteration count
    for (let i = 0; i < 200; i++) {
        const line = getTopLine(img, minY);
        if (line >= maxY)
            break; // no other black pixels available
        const bounds = getTopLeftCharBounds(img, 0, maxX, line, line + avgCharBounds.h - 20);
        if (!bounds)
            break;
        minY = bounds.y2 + 1 + 20;
        const heightFactor = Math.max(Math.round(bounds.h / avgCharBounds.h), 1);
        // const widthFactor = Math.max(Math.round(bounds.w / avgCharBounds.w), 1);
        const subBounds = splitBoundVertically(img, bounds, heightFactor, lookaround);
        for (const bound of subBounds) {
            boundsList.push(bound);
        }
    }
    return boundsList;
}
exports.getLineFirstCharBounds = getLineFirstCharBounds;
function splitBoundVertically(img, bounds, resultant, lookaround) {
    if (resultant <= 1)
        return [bounds];
    const step = bounds.h / resultant;
    let offset = bounds.y;
    const boundsList = [];
    for (let i = 0; i < resultant - 1; i++) {
        // do lookaround
        const startY = Math.floor(Math.max(0, offset + step - lookaround));
        const endY = Math.ceil(Math.min(img.bitmap.height - 1, offset + step + lookaround));
        let minY = step * i;
        let minWidth = Infinity;
        for (let y = startY; y <= endY; y++) {
            let width = 0;
            for (let x = bounds.x; x <= bounds.x2; x++) {
                if ((0, jimpable_js_1.getPixelAt)(img, x, y) != 0xFF)
                    width++;
            }
            if (width < minWidth) {
                minWidth = width;
                minY = y;
            }
        }
        boundsList.push({
            x: bounds.x,
            y: offset,
            x2: bounds.x2,
            y2: minY,
            w: bounds.w,
            h: minY - offset
        });
        offset = minY;
    }
    boundsList.push({
        x: bounds.x,
        y: offset,
        x2: bounds.x2,
        y2: bounds.y2,
        w: bounds.w,
        h: bounds.y2 - offset
    });
    return boundsList;
}
function getTopLine(img, minY) {
    for (let y = minY; y < img.bitmap.height; y++) {
        for (let x = 0; x < img.bitmap.width; x++) {
            const idx = 4 * (x + y * img.bitmap.width);
            if (img.bitmap.data[idx] == 0)
                return y;
        }
    }
    return img.bitmap.height; // sentinal (effectively)
}
exports.getTopLine = getTopLine;
function getLineCharBounds(img, minY, maxY) {
    const boundsList = [];
    let minX = 0;
    const maxX = img.bitmap.width;
    // while(true), but with a limit of 200
    for (let i = 0; i < 200; i++) {
        const bounds = getTopLeftCharBounds(img, minX, maxX, minY, maxY);
        if (!bounds)
            break;
        boundsList.push(bounds);
        minX = bounds.x2 + 1; // push boundary forwards so same char is not bounded again
    }
    return boundsList;
}
exports.getLineCharBounds = getLineCharBounds;
function getTopLeftCharBounds(img, minX, maxX, minY, maxY) {
    const xDiff = (0, settings_js_1.getSetting)("charBounds.xDiff");
    let charMinX = Infinity;
    let charMinY = 0;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const idx = 4 * (x + y * img.bitmap.width);
            if (img.bitmap.data[idx] != 0)
                continue; // go to next
            if (x < charMinX - xDiff) {
                charMinX = x;
                charMinY = y;
            }
        }
    }
    if (charMinX == Infinity)
        return null;
    return (0, floodable_js_1.floodFillBounds)(img, charMinX, charMinY);
}
exports.getTopLeftCharBounds = getTopLeftCharBounds;
function getAverageCharBounds(boundsList) {
    const widths = [];
    const heights = [];
    for (const bounds of boundsList) {
        widths.push(bounds.w);
        heights.push(bounds.h);
    }
    widths.sort();
    heights.sort();
    return {
        w: getMiddle(widths),
        h: getMiddle(heights)
    };
}
exports.getAverageCharBounds = getAverageCharBounds;
function getMiddle(list) {
    if (list.length % 2 == 0)
        return (list[list.length / 2] + list[list.length / 2 - 1]) / 2;
    else
        return list[(list.length - 1) / 2];
}
//# sourceMappingURL=boundable.js.map