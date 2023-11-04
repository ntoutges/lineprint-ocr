"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doPostProcess = exports.TokenText = void 0;
const postprocessing_js_1 = require("./postprocessing.js");
const settings_js_1 = require("./settings.js");
class TokenText {
    lines = [];
    constructor(tokens) {
        for (const line of tokens) {
            let text = "";
            for (const token of line) {
                text += token.value;
            }
            this.lines.push({
                text,
                tokens: line
            });
        }
    }
    get length() { return this.lines.length; }
    getText(line) { return this.lines[line].text; }
    getToken(line, index) { return this.lines[line].tokens[index]; }
    getChar(line, index) {
        return {
            text: this.getText(line)[index],
            token: this.getToken(line, index)
        };
    }
    setText(line, text) {
        let newText = "";
        for (let i = 0; i < this.lines[line].text.length; i++) {
            const value = text[i] ?? null;
            this.getToken(line, i).value = value;
            if (value)
                newText += value;
            else
                newText += " "; // char to use for unknown character
        }
        this.lines[line].text = newText;
    }
    setChar(line, index, char) {
        this.getToken(line, index).value = char[0]; // ensure char is only one character
        // recalculate text
        let text = "";
        for (const token of this.lines[line].tokens) {
            text += token.value;
        }
        this.lines[line].text = text;
    }
    toString() {
        let text = "";
        for (const line of this.lines) {
            text += line.text + "\n";
        }
        return text.substring(0, text.length - 1); // remove newline at end
    }
}
exports.TokenText = TokenText;
// use both text and images as context for finishing the work
function doPostProcess(tokenText) {
    const toDoMap = (0, settings_js_1.getSetting)("postprocessing.enabled", {});
    for (const step in toDoMap) {
        if (!(step in postprocessing_js_1.steps)) { // step does not exist
            console.log(`: PostProcess Step: \"\x1b[31m${step}\x1b[0m\" does not exist`);
            continue;
        }
        const specificSetting = (0, settings_js_1.getSetting)(`postprocessing.settings.${step}`, {});
        console.log(`: PostProcess Step: \"\x1b[32m${step}\x1b[0m\"`);
        postprocessing_js_1.steps[step](tokenText, specificSetting);
    }
}
exports.doPostProcess = doPostProcess;
//# sourceMappingURL=postprocessable.js.map