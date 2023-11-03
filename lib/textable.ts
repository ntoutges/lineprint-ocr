import { Token } from "./tokenable";

export function toText(tokens: Token[][], unknown:string = "?") {
  let text = "";
  for (const line of tokens) {
    for (const token of line) {
      text += token.value ?? unknown;
    }
    text += "\n";
  }
  return text.substring(0,text.length-1); // remove final newline
}