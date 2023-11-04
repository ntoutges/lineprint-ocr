"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recognizeFromTrainingDataset = exports.constructTrainingDataset = exports.addToTrainingDataset = exports.init = void 0;
const Jimp = require("jimp");
const settings_1 = require("./settings");
const fsExt_1 = require("./fsExt");
const fs = require("fs");
const refImages = {};
function init() {
    const files = fs.readdirSync(__dirname + "/../io/training");
    const promises = [];
    for (const name of files) {
        const filename = __dirname + "/../io/training/" + name;
        promises.push(new Promise(resolve => {
            Jimp.read(filename, (err, img) => {
                if (err)
                    console.error(err);
                refImages[String.fromCharCode(+(0, fsExt_1.extensionless)(name))] = img;
                resolve("");
            });
        }));
    }
    return Promise.all(promises);
}
exports.init = init;
const allTokens = {};
function addToTrainingDataset(tokens) {
    for (const char in tokens) {
        if (char == " ")
            continue; // ignore spaces
        if (!(char in allTokens))
            allTokens[char] = [];
        allTokens[char] = allTokens[char].concat(tokens[char]);
    }
}
exports.addToTrainingDataset = addToTrainingDataset;
function constructTrainingDataset() {
    return new Promise((resolve, reject) => {
        const files = fs.readdirSync(__dirname + "/../io/training");
        const promises = [];
        for (const filename of files) {
            promises.push(new Promise(resolve => {
                fs.unlink(__dirname + "/../io/training/" + filename, resolve);
            }));
        }
        Promise.all(promises).then(() => {
            averageTokens().then((data) => {
                resolve(data);
            });
        }).catch(err => { reject(err); });
    });
}
exports.constructTrainingDataset = constructTrainingDataset;
// function clamp(val: number, min: number, max: number) {
//   return Math.min(Math.max(val, min), max);
// }
function averageTokens() {
    const xCenterWeight = (0, settings_1.getSetting)("recognition.x-center-weight");
    const yCenterWeight = (0, settings_1.getSetting)("recognition.y-center-weight");
    const promises = [];
    // get max bounds
    let maxW = 0;
    let maxH = 0;
    for (let char in allTokens) {
        for (const token of allTokens[char]) {
            maxW = Math.max(maxW, token.bounds.w);
            maxH = Math.max(maxH, token.bounds.h);
        }
    }
    // add buffer to allow characters to move around
    maxW += 5;
    maxH += 5;
    for (let char in allTokens) {
        // fill pixelData table
        const pixelData = new Map(); // stores distance from white
        for (const token of allTokens[char]) {
            const offX = Math.round((maxW / 2 - token.center.x) * xCenterWeight);
            const offY = Math.round((maxH / 2 - token.center.y) * yCenterWeight);
            token.img.scan(0, 0, token.bounds.w, token.bounds.h, (x, y, idx) => {
                const xAdj = x + offX;
                const yAdj = y + offY;
                if (xAdj >= maxW || yAdj >= maxH)
                    return; // this would cause wrap-around; as such, ignore
                const id = xAdj + yAdj * maxW;
                if (!pixelData.has(id))
                    pixelData.set(id, 0xFF - token.img.bitmap.data[idx]);
                else {
                    const old = pixelData.get(id);
                    pixelData.set(id, old + 0xFF - token.img.bitmap.data[idx]);
                }
            });
        }
        const count = Object.keys(allTokens[char]).length;
        new Jimp(maxW, maxH, 0xFFFFFFFF, (err, img) => {
            img.scan(0, 0, maxW, maxH, (x, y, idx) => {
                const id = x + y * maxW;
                let value = 0xFF; // default value
                if (pixelData.has(id))
                    value -= Math.round(pixelData.get(id) / count);
                if (value == 0xff)
                    return;
                img.bitmap.data[idx + 0] = value; // r
                img.bitmap.data[idx + 1] = value; // g
                img.bitmap.data[idx + 2] = value; // b
            });
            img.write(__dirname + "/../io/training/" + char.charCodeAt(0) + ".png");
        });
    }
    return Promise.all(promises);
}
async function recognizeFromTrainingDataset(tokens) {
    const xCenterWeight = (0, settings_1.getSetting)("recognition.x-center-weight");
    const yCenterWeight = (0, settings_1.getSetting)("recognition.y-center-weight");
    let i = 0;
    const lineCt = Object.keys(tokens).length;
    for (const line of tokens) {
        process.stdout.write(`: ${++i}/${lineCt} lines processed\r`);
        for (const token of line) {
            if (token.value == " ")
                continue; // ignore spaces
            let minDistance = Infinity;
            let minChar = null;
            let formatedTestImg = null;
            for (const char in refImages) {
                const refImage = refImages[char];
                const width = refImage.bitmap.width;
                const height = refImage.bitmap.height;
                if (!formatedTestImg) {
                    formatedTestImg = await formatImage(// all reference images should have the same bounds
                    token, width, height, xCenterWeight, yCenterWeight);
                    token.img = formatedTestImg;
                }
                const distance = getImageDifference(formatedTestImg, refImage);
                if (distance < minDistance) { // find best character
                    minDistance = distance;
                    minChar = char;
                }
            }
            // assign best character
            token.value = minChar;
        }
    }
    return tokens;
}
exports.recognizeFromTrainingDataset = recognizeFromTrainingDataset;
function formatImage(token, width, height, xWeight, yWeight) {
    return new Promise(async (resolve) => {
        const offX = Math.round((width / 2 - token.center.x) * xWeight);
        const offY = Math.round((height / 2 - token.center.y) * yWeight);
        const tokenImg = token.img;
        new Jimp(width, height, 0xffffffff, (err, img) => {
            tokenImg.scan(0, 0, tokenImg.bitmap.width, tokenImg.bitmap.height, (x, y, idx) => {
                const xAdj = x + offX;
                const yAdj = y + offY;
                if (xAdj >= width || yAdj >= height)
                    return; // this would cause wrap-around; as such, ignore
                const value = tokenImg.bitmap.data[idx];
                if (value == 0xff)
                    return;
                const id = 4 * (xAdj + yAdj * width);
                img.bitmap.data[id + 0] = value;
                img.bitmap.data[id + 1] = value;
                img.bitmap.data[id + 2] = value;
            });
            resolve(img);
        });
    });
}
// assume img1 and img2 have the same bounds
function getImageDifference(img1, img2) {
    let totalDist = 0;
    img1.scan(0, 0, img1.bitmap.width, img1.bitmap.height, (x, y, idx) => {
        totalDist += Math.abs(img1.bitmap.data[idx] - img2.bitmap.data[idx]);
    });
    return totalDist;
}
//# sourceMappingURL=trainable.js.map