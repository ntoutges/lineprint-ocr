"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const Jimp = require("jimp");
const fs = require("fs");
const fsExt_js_1 = require("./fsExt.js");
const jimpable_js_1 = require("./jimpable.js");
const timer_js_1 = require("./timer.js");
const settings_js_1 = require("./settings.js");
const textable_js_1 = require("./textable.js");
const tokenable_js_1 = require("./tokenable.js");
const trainable_js_1 = require("./trainable.js");
function main(args, namedArgs) {
    if (args.length == 0) { // read all
        args = (0, fsExt_js_1.getAllFiles)(["png"]);
    }
    // args = args.map((filename) => { return toAbsoluteInput(filename); }); // convert to absolute path
    const start = (new Date()).getTime();
    const promises = [];
    for (const filename of args) {
        console.log(`: Processing [${filename}]`);
        promises.push(new Promise((resolve, reject) => {
            doConversion((0, fsExt_js_1.toAbsoluteInput)(filename), (0, fsExt_js_1.toAbsoluteOutput)(filename), filename, namedArgs).then((result) => {
                console.log(`: Completed [${filename}] with output of \"${result}\"`);
                resolve(result);
            }).catch(err => { reject(err); });
        }));
    }
    Promise.all(promises).then(result => {
        const end = (new Date()).getTime();
        const delta = Math.round((end - start) / 10) / 100;
        console.log(`::Processed ${args.length} ${args.length == 1 ? "file" : "files"} in ${delta}s`);
    }).catch(err => { console.error(err); });
}
exports.main = main;
function doConversion(input, output, name, namedArgs) {
    return new Promise((resolve, reject) => {
        try {
            (0, timer_js_1.startTimer)();
            Jimp.read(input, (err, img) => {
                writeMessage(`successfully read`, name);
                const simplified = (0, jimpable_js_1.simplify)(img);
                writeMessage("simplified", name);
                const destrung = (0, jimpable_js_1.destring)(simplified.clone());
                writeMessage("destrung", name);
                const denoised = (0, jimpable_js_1.denoise)(destrung.clone());
                writeMessage("denoised", name);
                const pruned = (0, jimpable_js_1.horizontalPrune)(denoised.clone());
                writeMessage("pruned", name);
                const tokens = (0, jimpable_js_1.getCharTokens)(pruned.clone());
                writeMessage("tokenized", name);
                if ((0, settings_js_1.getSetting)("charHighlight.doOutputBounds")) {
                    const bounded = (0, jimpable_js_1.highlightChars)(destrung.clone(), tokens);
                    writeMessage("highlighted", name);
                    bounded.write(output);
                }
                (0, tokenable_js_1.fillTokenImages)(destrung, tokens);
                writeMessage("separated images", name);
                if ("train" in namedArgs) {
                    (0, tokenable_js_1.fillKnownTokens)(tokens, fs.readFileSync(__dirname + "/../io/input/009.txt").toString());
                    const categorized = (0, tokenable_js_1.categorizeTokens)(tokens);
                    (0, tokenable_js_1.writeCategorizedImages)(__dirname + "/../io/output/training", categorized);
                    (0, trainable_js_1.constructTrainingDataset)(categorized, namedArgs.train);
                }
                fs.writeFileSync((0, fsExt_js_1.setExt)(output, "txt"), (0, textable_js_1.toText)(tokens, "?"));
                resolve("Ok.");
            });
        }
        catch (err) {
            reject(err.toString());
        }
    });
}
function writeMessage(message, name) {
    const time = (0, timer_js_1.lap)();
    const timeStr = `${Math.round(time / 10) / 100}s`;
    console.log(`: [\x1b[36m${name}\x1b[0m] ${message} (\x1b[33m${timeStr}\x1b[0m)`);
}
//# sourceMappingURL=main.js.map