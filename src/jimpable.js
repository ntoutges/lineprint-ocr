"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPixelAt = exports.getPixelAt = exports.highlightLines = exports.horizontalPrune = exports.destring = exports.denoise = exports.simplify = void 0;
const settings_js_1 = require("./settings.js");
const floodable_js_1 = require("./floodable.js");
const boundable_js_1 = require("./boundable.js");
const prunable_js_1 = require("./prunable.js");
function simplify(img) {
    const rWeight = (0, settings_js_1.getSetting)("simplify.weights.r");
    const gWeight = (0, settings_js_1.getSetting)("simplify.weights.g");
    const bWeight = (0, settings_js_1.getSetting)("simplify.weights.b");
    const threshold = (0, settings_js_1.getSetting)("simplify.threshold");
    const baseWeight = (0, settings_js_1.getSetting)("simplify.weights.base");
    let base = 0;
    if (baseWeight != 0) { // used to adjust for lighting
        let pixelCt = img.bitmap.width * img.bitmap.height;
        let total = 0n; // bigint to handle massive values
        img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
            const r = img.bitmap.data[idx + 0] * rWeight;
            const g = img.bitmap.data[idx + 1] * gWeight;
            const b = img.bitmap.data[idx + 2] * bWeight;
            const sum = r + g + b;
            total += BigInt(Math.round(sum * baseWeight));
        });
        base = Number(total / BigInt(pixelCt));
    }
    const width = img.bitmap.width;
    const height = img.bitmap.height;
    img.scan(0, 0, width, height, (x, y, idx) => {
        const r = img.bitmap.data[idx + 0] * rWeight;
        const g = img.bitmap.data[idx + 1] * gWeight;
        const b = img.bitmap.data[idx + 2] * bWeight;
        if ((r + g + b) - base < threshold) { // under threshold, convert to 0s
            img.bitmap.data[idx + 0] = 0;
            img.bitmap.data[idx + 1] = 0;
            img.bitmap.data[idx + 2] = 0;
        }
        else { // above threshold, convert to 255s
            img.bitmap.data[idx + 0] = 0xFF;
            img.bitmap.data[idx + 1] = 0xFF;
            img.bitmap.data[idx + 2] = 0xFF;
        }
    });
    return img;
}
exports.simplify = simplify;
// remove stray dots of white or black
function denoise(img) {
    const limit = (0, settings_js_1.getSetting)("denoise.limit"); // convert proportion to value
    const fillBorders = (0, settings_js_1.getSetting)("denoise.autofill-borders"); // skip check for necessary size of flood fill
    const width = img.bitmap.width;
    const height = img.bitmap.height;
    const blacklist = new Set();
    img.scan(0, 0, width, height, (x, y, idx) => {
        if (img.bitmap.data[idx] != 0)
            return; // skip white pixels, not important
        if (blacklist.has(x + y * width)) {
            return;
        }
        const skip = fillBorders && (x < fillBorders || y < fillBorders || x >= width - fillBorders || y >= height - fillBorders);
        if (skip || (0, floodable_js_1.floodFillUntil)(img, x, y, limit) > 0) { // flood fill couldn't fill all
            (0, floodable_js_1.floodFill)(img, x, y);
        }
        else
            (0, floodable_js_1.floodFillAdd)(img, x, y, blacklist);
    });
    return img;
}
exports.denoise = denoise;
// get rid of noise surrounding characters
function destring(img) {
    const scanner = img.clone();
    scanner.scan(0, 0, scanner.bitmap.width, scanner.bitmap.height, (x, y, idx) => {
        if (scanner.bitmap.data[idx] != 0)
            return; // not a black pixel
        // get surrounding pixel values
        const up = getPixelAt(scanner, x, y - 1, 0xff);
        const down = getPixelAt(scanner, x, y + 1, 0xff);
        const left = getPixelAt(scanner, x - 1, y, 0xff);
        const right = getPixelAt(scanner, x + 1, y, 0xff);
        const isSurrounded = (up + down + left + right) == 0;
        if (!isSurrounded) { // remove this pixel
            setPixelAt(img, x, y, 0xFF);
        }
    });
    return img;
}
exports.destring = destring;
// remove pixels where: above is a "thick" region, below is a "thick" region, and between is a "thin" region
function horizontalPrune(img) {
    const debug = (0, settings_js_1.getSetting)("horizontalPrune.debug");
    const doDenoise = (0, settings_js_1.getSetting)("horizontalPrune.doDenoise");
    const { thickRegions, thinRegions } = (0, prunable_js_1.getRegions)(img);
    // highlight thin regions
    if (debug["highlight-thins"]) {
        for (const region of thinRegions) {
            img.scan(region.x, region.y, region.w, 1, (x, y, idx) => {
                setPixelAt(img, x, y, 0x80);
            });
        }
    }
    // highlight thick regions
    if (debug["highlight-thicks"]) {
        for (const region of thickRegions) {
            img.scan(region.x, region.y, region.w, 1, (x, y, idx) => {
                setPixelAt(img, x, y, 0x80, true);
            });
        }
    }
    const thickRegionC = (0, prunable_js_1.categorizeRegions)(thickRegions);
    const thinRegionC = (0, prunable_js_1.categorizeRegions)(thinRegions);
    const thickRegionG = (0, prunable_js_1.groupRegions)(thickRegionC);
    const pruningRegionFinalists = (0, prunable_js_1.getPrunableRegions)(thickRegionG, thinRegionC);
    const pruningRegions = (0, prunable_js_1.prunePrunableRegions)(img, pruningRegionFinalists);
    // highlight finalist regions
    if (debug["highlight-finalists"]) {
        for (const y in pruningRegions) {
            for (const region of pruningRegions[y]) {
                img.scan(region.x, region.y, region.w, 1, (x, y, idx) => {
                    setPixelAt(img, x, y, 0xFF, true);
                });
            }
        }
    }
    else { // not debugging this
        for (const y in pruningRegions) {
            for (const region of pruningRegions[y]) {
                img.scan(region.x, region.y, region.w, 1, (x, y, idx) => {
                    setPixelAt(img, x, y, 0xFF); // turn to white
                });
            }
        }
    }
    if (doDenoise)
        return denoise(img);
    return img;
}
exports.horizontalPrune = horizontalPrune;
// look for top-left (pure) black px
function highlightLines(img) {
    const firstBounds = (0, boundable_js_1.getLineCharBounds)(img, 0, img.bitmap.height);
    const avgChar = (0, boundable_js_1.getAverageCharBounds)(firstBounds);
    const boundsList = (0, boundable_js_1.getLineFirstCharBounds)(img, avgChar);
    // for (const boundsLine of boundsList) {
    for (const bounds of boundsList) {
        img.scan(bounds.x, bounds.y, bounds.w, bounds.h, (x, y, idx) => {
            if (img.bitmap.data[idx] != 0) {
                setPixelAt(img, x, y, 0xA0);
            }
        });
        for (let x = bounds.x; x <= bounds.x2; x++) {
            setPixelAt(img, x, bounds.y, 0xFF, true);
            setPixelAt(img, x, bounds.y2, 0xFF, true);
        }
        for (let y = bounds.y; y <= bounds.y2; y++) {
            setPixelAt(img, bounds.x, y, 0xFF, true);
            setPixelAt(img, bounds.x2, y, 0xFF, true);
        }
    }
    // }
    return img;
}
exports.highlightLines = highlightLines;
function getPixelAt(img, x, y, fallback = 0xFF) {
    if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) {
        return fallback;
    }
    const idx = 4 * (x + img.bitmap.width * y); // 4 entries per pixel
    return img.bitmap.data[idx];
}
exports.getPixelAt = getPixelAt;
function setPixelAt(img, x, y, value, highlight = false) {
    if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height)
        return;
    const idx = 4 * (x + img.bitmap.width * y); // 4 entries per pixel
    img.bitmap.data[idx + 0] = value;
    img.bitmap.data[idx + 1] = value * +!highlight;
    img.bitmap.data[idx + 2] = value * +!highlight;
}
exports.setPixelAt = setPixelAt;
//# sourceMappingURL=jimpable.js.map