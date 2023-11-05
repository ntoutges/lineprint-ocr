import { Token } from "./tokenable.js";
import { steps } from "./postprocessing.js"
import { steps2 } from "./postprocessing2.js";
import { getSetting } from "./settings.js";

export class TokenText {
  private readonly lines: {text: string, tokens: Token[]}[] = [];

  constructor(tokens: Token[][]) {
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

  toString() {
    let text = "";
    for (const line of this.lines) {
      text += line.text + "\n";
    }
    return text.substring(0,text.length-1); // remove newline at end
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
