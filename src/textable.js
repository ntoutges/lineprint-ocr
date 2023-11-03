"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toText = void 0;
function toText(tokens, unknown = "?") {
    let text = "";
    for (const line of tokens) {
        for (const token of line) {
            text += token.value ?? unknown;
        }
        text += "\n";
    }
    return text.substring(0, text.length - 1); // remove final newline
}
exports.toText = toText;
//# sourceMappingURL=textable.js.map