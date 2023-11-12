import { Token } from "./tokenable.js";
import { steps } from "./postprocessing.js"
import { steps2 } from "./postprocessing2.js";
import { getSetting } from "./settings.js";
import Jimp = require("jimp");
import { Bounds } from "./floodable.js";

export class TokenText {
  private readonly lines: {text: string, tokens: Token[]}[] = [];
  readonly img: Jimp;

  constructor(tokens: Token[][], img: Jimp) {
    this.img = img;
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
  get tokens() {
    return this.lines.map((val) => val.tokens);
  }

  getText(line: number) { return this.lines[line].text; }
  getToken(line: number, index: number) { return this.lines[line].tokens[index]; }
  getChar(line: number, index: number) {
    return {
      text: this.getText(line)[index],
      token: this.getToken(line,index)
    };
  }

  setText(line: number, text: string) {
    let newText = "";
    for (let i = 0; i < this.lines[line].text.length; i++) {
      const value = text[i] ?? null;
      this.getToken(line, i).value = value;
      if (value) newText += value;
      else newText += " "; // char to use for unknown character
    }
    this.lines[line].text = newText;
  }

  setChar(line: number, index: number, char: string) {
    this.getToken(line,index).value = (char == null) ? null : char[0]; // ensure char is only one character
    
    // recalculate text
    let text = "";
    for (const token of this.lines[line].tokens) { text += (token.value == null) ? "?" : token.value; }
    this.lines[line].text = text;
  }

  spliceToken(line: number, index: number, removeCt: number, tokens:Token[] = []) {
    Array.prototype.splice.apply(
      this.lines[line].tokens,
      [].concat([index, removeCt], tokens)
    );
    
    this.rebuildText(line);
  }

  spliceSpace(line: number, index: number, changeCt: number) {
    if (changeCt == 0) return;
    
    // find earliest space before change
    let minI = 0;
    for (let i = index; i >= 0; i--) {
      if (this.lines[line].text[i] != " ") {
        minI = i+1;
        break;
      }
    }

    // find last space before change
    let maxI = this.lines[line].text.length-1;
    for (let i = index; i < maxI; i++) {
      if (this.lines[line].text[i] != " ") {
        maxI = i-1;
        break;
      }
    }
    const minX = this.lines[line].tokens[minI].bounds.x;
    const maxX = this.lines[line].tokens[maxI].bounds.x2;
    
    if (changeCt < 0) this.lines[line].tokens.splice(index,-changeCt); // remove old spaces
    else { // add new spaces
      const lastToken = this.lines[line].tokens[index];
      const newItems: Token[] = [];
      for (let i = 0; i < changeCt; i++) {
        newItems.push({
          adistance: 0,
          distances: {},
          bounds: lastToken.bounds,
          center: { x: 0, y: 0 },
          value: " "
        });
      }
      Array.prototype.splice.apply(this.lines[line].tokens, [].concat([index, 0], newItems));
    }

    this.rebuildText(line);

    // find earliest space after change
    minI = 0;
    for (let i = index; i >= 0; i--) {
      if (this.lines[line].text[i] != " ") {
        minI = i+1;
        break;
      }
    }

    // find last space after change
    maxI = this.lines[line].text.length-1;
    for (let i = index; i < maxI; i++) {
      if (this.lines[line].text[i] != " ") {
        maxI = i-1;
        break;
      }
    }

    // set new bounds
    const baseBounds = this.lines[line].tokens[index].bounds;
    
    const boundCt = maxI - minI + 1;
    const step = (maxX - minX) / boundCt;

    for (let i = 0; i < boundCt; i++) {
      const x1 = Math.round(minX + i*step);
      const x2 = Math.round(minX + (i+1)*step);

      this.lines[line].tokens[minI + i].bounds = {
        y: baseBounds.y,
        y2: baseBounds.y2,
        h: baseBounds.h,
        x: x1,
        x2: x2 - 2,
        w: x2 - x1 - 2
      }
    }
  }

  private rebuildText(line: number) {
    this.lines[line].text = this.lines[line].tokens.map((val) => val.value ?? "?").join("");
  }

  toString() {
    let text = "";
    for (const line of this.lines) {
      text += line.text + "\n";
    }
    return text.substring(0,text.length-1); // remove newline at end
  }

  forEachColumn(callback: (column: Record<number,Token>, x: number) => void) {
    for (let x = 0; x < 200; x++) { // 200 as upper bound
      let column: Record<number,Token> = {};
      for (let y = 0; y < this.lines.length; y++) {
        if (this.lines[y].text.length <= x) continue;
        
        column[y] = this.lines[y].tokens[x];
      }
      if (Object.keys(column).length == 0) return; // stop if no more characters
      callback(column,x);
    }
  }
}

// use both text and images as context for finishing the work
export function doPostProcess(tokenText: TokenText) {
  const toDoMap = getSetting<Record<string,boolean>>("postprocessing.enabled", {});
  for (const step in toDoMap) {
    if (!(step in steps)) { // step does not exist
      console.log(`: PostProcess Step: \"\x1b[31m${step}\x1b[0m\" does not exist`);  
      continue;
    }
    if (!toDoMap[step]) continue;
    const specificSetting = getSetting<Record<string,any>>(`postprocessing.settings.${step}`, {});
    console.log(`: PostProcess Step: \"\x1b[32m${step}\x1b[0m\"`);
    steps[step](tokenText, specificSetting);
  }
}

// use both text and images as context for finishing the work
export function doPostProcess2(text: string) {
  const toDoMap = getSetting<Record<string,boolean>>("post-postprocessing.enabled", {});
  for (const step in toDoMap) {
    if (!(step in steps2)) { // step does not exist
      console.log(`: PostPostProcess Step: \"\x1b[31m${step}\x1b[0m\" does not exist`);  
      continue;
    }
    if (!toDoMap[step]) continue;
    const specificSetting = getSetting<Record<string,any>>(`post-postprocessing.settings.${step}`, {});
    console.log(`: PostPostProcess Step: \"\x1b[32m${step}\x1b[0m\"`);
    text = steps2[step](text, specificSetting);
  }
  return text;
}
