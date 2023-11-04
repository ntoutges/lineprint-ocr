"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAbsoluteOutput = exports.toAbsoluteInput = exports.appendToName = exports.extensionless = exports.setExt = exports.getAllFiles = void 0;
const fs = require("fs");
function getAllFiles(validTypes) {
    const validSet = new Set(validTypes);
    const filenames = fs.readdirSync(__dirname + "/../io/input");
    const validFileNames = [];
    for (const filename of filenames) {
        if (validSet.has(getExt(filename))) {
            validFileNames.push(filename);
        }
    }
    return validFileNames;
}
exports.getAllFiles = getAllFiles;
function getExt(filename) {
    const i = filename.lastIndexOf(".");
    if (i == -1)
        return "txt"; // implicit
    return filename.substring(i + 1);
}
function setExt(filename, ext) {
    const i = filename.lastIndexOf(".");
    if (i == -1)
        return filename + "." + ext; // no extension
    return filename.substring(0, i) + "." + ext;
}
exports.setExt = setExt;
function extensionless(filename) {
    const i = filename.lastIndexOf(".");
    if (i == -1)
        return filename; // implicit
    return filename.substring(0, i);
}
exports.extensionless = extensionless;
function appendToName(filename, append) {
    const i = filename.lastIndexOf(".");
    if (i == -1)
        return filename + append; // no extension
    return filename.substring(0, i) + append + filename.substring(i); // squish append between name of file and extension
}
exports.appendToName = appendToName;
function toAbsoluteInput(filename) {
    return __dirname + "/../io/input/" + filename;
}
exports.toAbsoluteInput = toAbsoluteInput;
function toAbsoluteOutput(filename) {
    return __dirname + "/../io/output/" + filename;
}
exports.toAbsoluteOutput = toAbsoluteOutput;
//# sourceMappingURL=fsExt.js.map