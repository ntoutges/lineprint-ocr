"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const Jimp = require("jimp");
const fsExt_js_1 = require("./fsExt.js");
const jimpable_js_1 = require("./jimpable.js");
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
            doConversion((0, fsExt_js_1.toAbsoluteInput)(filename), (0, fsExt_js_1.toAbsoluteOutput)(filename), filename).then((result) => {
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
function doConversion(input, output, name) {
    return new Promise((resolve, reject) => {
        try {
            Jimp.read(input, (err, img) => {
                console.log(`: Successfully read [${name}]`);
                const simplified = (0, jimpable_js_1.simplify)(img);
                console.log(":>simplified");
                const destrung = (0, jimpable_js_1.destring)(simplified.clone());
                console.log(":>destrung");
                const denoised = (0, jimpable_js_1.denoise)(destrung.clone());
                console.log(":>denoised");
                const pruned = (0, jimpable_js_1.horizontalPrune)(denoised.clone());
                console.log(":>pruned");
                const detected = (0, jimpable_js_1.highlightLines)(pruned.clone());
                console.log(":>highlighted");
                // simplified.write(output);
                // destrung.write(appendToName(output, "1"));
                // denoised.write(appendToName(output, "2"));
                // pruned.write(appendToName(output,"3"));
                detected.write((0, fsExt_js_1.appendToName)(output, "4"));
                resolve("Ok.");
            });
        }
        catch (err) {
            reject(err.toString());
        }
    });
}
//# sourceMappingURL=main.js.map