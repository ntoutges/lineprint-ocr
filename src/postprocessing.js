"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.steps = void 0;
const featureable_js_1 = require("./featureable.js");
// functions mutate original input
exports.steps = {
    ";/: Correction": correctSemiAndFullColon,
    "B/8 Correction": correctBandEight
};
// user defined functinos for application-specific tasks
function correctSemiAndFullColon(input, settings) {
    const minRatio = settings["min-ratio"];
    for (let y = 0; y < input.length; y++) {
        const line = input.getText(y);
        for (let x = 1; x < line.length; x++) {
            // consider converting ":" -> ";"
            if (line[x] == ":" && line[x - 1] == " ") { // previous character is empty, and current character is a colon
                const distance = input.getToken(y, x).distances[";"];
                if (distance < minRatio)
                    input.setChar(y, x, ";");
            }
            // consider converting ";" -> ":"
            else if (line[x] == ";" && line[x - 1] != " ") { // previous character is not empty, and current character is a semicolon
                const distance = input.getToken(y, x).distances[":"];
                if (distance < minRatio)
                    input.setChar(y, x, ":");
            }
        }
    }
}
// notoriously hard to tell apart
function correctBandEight(input, settings) {
    const minRatio = settings["min-ratio"];
    const flatnessSmoothing = settings["flatness-smoothing"];
    const threshold = settings["threshold"];
    for (let y = 0; y < input.length; y++) {
        const line = input.getText(y);
        for (let x = 0; x < line.length; x++) {
            if (line[x] != "8" && line[x] != "B")
                continue;
            const currentWord = getWord(line, x);
            const distance = (0, featureable_js_1.leftFlatness)(input.getToken(y, x).img, flatnessSmoothing);
            if (distance >= threshold)
                input.setChar(y, x, "8");
            else
                input.setChar(y, x, "B");
        }
    }
}
function getWord(text, index) {
    let minX = index;
    let maxX = index;
    // find start of word
    for (let i = index - 1; i >= 0; i--) {
        if (text[i] == " ") { // end of word
            minX = i + 1;
            break;
        }
        if (i == 0)
            minX = 0;
    }
    // find end of word
    for (let i = index + 1; i < text.length; i++) {
        if (text[i] == " ") { // end of word
            maxX = i;
            break;
        }
        if (i == text.length - 1)
            maxX = i + 1;
    }
    return text.substring(minX, maxX);
}
const hexablePattern = /^(0x)?[\dabcdef]+$/i;
function isHexable(text) {
    return !!text.match(hexablePattern);
}
//# sourceMappingURL=postprocessing.js.map