"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeCategorizedImages = exports.writeTokenImages = exports.categorizeTokens = exports.fillKnownTokens = exports.fillTokenImages = exports.tokenizeBounds = exports.getTopmostBound = exports.getLeftmostBound = exports.getTextOrigion = void 0;
function getTextOrigion(boundsList) {
    const leftMost = getLeftmostBound(boundsList);
    const topMost = getTopmostBound(boundsList);
    return {
        x: leftMost.x,
        y: topMost.y
    };
}
exports.getTextOrigion = getTextOrigion;
function getLeftmostBound(boundsList) {
    let minBound = null;
    for (const line of boundsList) {
        const firstBound = line[0];
        if (!minBound || firstBound.x < minBound.x) {
            minBound = firstBound;
        }
    }
    return minBound;
}
exports.getLeftmostBound = getLeftmostBound;
function getTopmostBound(boundsList) {
    let minBound = null;
    for (const line of boundsList) {
        const firstBound = line[0];
        if (!minBound || firstBound.y < minBound.y) {
            minBound = firstBound;
        }
    }
    return minBound;
}
exports.getTopmostBound = getTopmostBound;
function tokenizeBounds(boundsList, origin, avgCharSize) {
    const tokens = [];
    let lastCharY = origin.y - avgCharSize.h; // as if first char hasn't yet been printed
    for (const line of boundsList) {
        if (line.length == 0)
            continue; // ignore empty list
        // add in extra "newlines"
        const firstChar = line[0];
        const gapY = firstChar.y - lastCharY;
        const heightFactor = Math.round(gapY / avgCharSize.h); // this should be 0/1 for no space, then 2+ for 1+ spaces
        lastCharY = firstChar.y;
        for (let j = 1; j < heightFactor; j++) { // loop [heightFactor-1] times
            tokens.push([]); // no chars needed--empty line
        }
        let lastCharX = origin.x - avgCharSize.w; // as if first char hasn't yet been printed
        const localTokens = [];
        for (let i = 0; i < line.length; i++) {
            const bounds = line[i];
            const gap = bounds.x - lastCharX;
            const widthFactor = Math.round(gap / avgCharSize.w); // this should be 0/1 for no space, then 2+ for 1+ spaces
            // push spaces
            const step = Math.floor(gap / widthFactor);
            for (let j = 1; j < widthFactor; j++) { // loop [widthFactor-1] times
                const offX = Math.floor(step * j);
                localTokens.push({
                    bounds: {
                        w: step - 2,
                        h: avgCharSize.h,
                        x: lastCharX + offX,
                        x2: lastCharX + offX + step - 2,
                        y: bounds.y,
                        y2: bounds.y + avgCharSize.h
                    },
                    value: " ",
                    center: {
                        x: 0,
                        y: 0
                    }
                });
            }
            // push actual character
            localTokens.push({
                bounds,
                value: null,
                center: null
            });
            lastCharX = bounds.x;
        }
        tokens.push(localTokens);
    }
    return tokens;
}
exports.tokenizeBounds = tokenizeBounds;
function fillTokenImages(img, tokens) {
    let i = 0;
    const lineCt = Object.keys(tokens).length;
    for (const line of tokens) {
        process.stdout.write(`: ${++i}/${lineCt} lines processed\r`);
        for (const token of line) {
            if (token.value != null)
                continue; // only retrieve those whose value is unknown
            token.img = img.clone().crop(token.bounds.x, token.bounds.y, token.bounds.w, token.bounds.h);
            let xWeight = 0;
            let yWeight = 0;
            let total = 0;
            token.img.scan(0, 0, token.img.bitmap.width, token.img.bitmap.height, (x, y, idx) => {
                if (token.img.bitmap.data[idx] == 0xFF)
                    return; // ignore
                // add weights
                xWeight += x;
                yWeight += y;
                total++;
            });
            token.center = {
                x: Math.floor(xWeight / total),
                y: Math.floor(yWeight / total)
            };
        }
    }
    return tokens; // in case I ever want the function to be daisy-chained
}
exports.fillTokenImages = fillTokenImages;
function fillKnownTokens(tokens, text) {
    // remove spaces/empty lines from text (they serve no purpose, besides formatting when initially putting in text); split into lines
    const textLines = text.replace(/ |\r|\n\n|/g, "").split("\n");
    let line = 0;
    for (const i in tokens) {
        if (tokens[i].length == 0)
            continue; // ignore line
        if (line >= textLines.length) {
            console.log(`WARNING: known text has less lines than tokens implies. ${line} vs ${textLines.length}`);
            break; // out of known text
        }
        let index = 0;
        for (const j in tokens[i]) {
            if (tokens[i][j].value == " ")
                continue; // skip spaces
            if (index >= textLines[line].length) {
                console.log(`WARNING: known text on line [${line + 1}] (${textLines[line]}) has less chars than tokens implies.`);
                break;
            }
            const knownChar = textLines[line][index];
            tokens[i][j].value = knownChar;
            index++;
        }
        if (index < textLines[line].length - 1) {
            console.log(`WARNING: known text on line [${line + 1}] (${textLines[line]}) has more chars than tokens implies.`);
            line++;
            continue;
        }
        line++;
    }
    if (line + 1 < textLines.length) {
        console.log(`WARNING: known text has more lines than tokens implies. ${line + 1} vs ${textLines.length}`);
    }
    return tokens;
}
exports.fillKnownTokens = fillKnownTokens;
function categorizeTokens(tokens) {
    const categories = {};
    for (const line of tokens) {
        for (const token of line) {
            if (token.value == null)
                continue; // ignore
            if (!(token.value in categories))
                categories[token.value] = [];
            categories[token.value].push(token);
        }
    }
    return categories;
}
exports.categorizeTokens = categorizeTokens;
function writeTokenImages(folder, tokens) {
    for (const line in tokens) {
        for (const i in tokens[line]) {
            const token = tokens[line][i];
            if (!token.img)
                continue;
            token.img.write(`${folder}/${line}_${i}.png`);
        }
    }
}
exports.writeTokenImages = writeTokenImages;
function writeCategorizedImages(folder, tokens) {
    for (const char in tokens) {
        let i = 0;
        for (const token of tokens[char]) {
            if (!token.img)
                continue;
            token.img.write(`${folder}/${char}_${i++}.png`);
        }
    }
}
exports.writeCategorizedImages = writeCategorizedImages;
//# sourceMappingURL=tokenable.js.map