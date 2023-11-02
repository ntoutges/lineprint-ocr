"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetting = exports.init = void 0;
const fs = require("fs");
var settings = null;
function init() {
    return new Promise((resolve, reject) => {
        try {
            settings = JSON.parse(fs.readFileSync(__dirname + "/../settings.json").toString().replace(/(\/\*.+\*\/)|(\/\/[^\n]*\n)/gs, "") // gets rid of comments
            );
            resolve("");
        }
        catch (err) {
            reject(err.toString());
        }
    });
}
exports.init = init;
function getSetting(keyStr, fallback = undefined) {
    const keyArr = keyStr.split(".");
    let head = settings;
    for (const key of keyArr) {
        if (head == null || typeof head != "object")
            return fallback;
        if (!(key in head))
            return fallback;
        head = head[key];
    }
    return head;
}
exports.getSetting = getSetting;
//# sourceMappingURL=settings.js.map