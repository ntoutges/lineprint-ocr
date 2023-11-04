const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
import { getSetting } from "./settings";

const finalText: Record<number, string> = {};

export function addToCombo(index: number, text: string) {
  finalText[index] = text;
}

export function finalizeCombo() {
  return new Promise<string>(resolve => {
    let seperator = "\n" + getSetting<string>("combination.file-seperator");
    const outfilename = getSetting<string>("combination.outfile");
    const unknownsToPrompt = getSetting<string[]>("combination.prompt-unknown");
    const autocorrect = getSetting<Record<string,string>>("combination.autocorrect");
    const disregardHeader = getSetting<boolean>("combination.disregard-header");

    const utpSet = new Set<string>();
    for (const unknown of unknownsToPrompt) { utpSet.add(unknown); }

    if (seperator.length > 1 && seperator[seperator.length-1] != "\n") seperator += "\n";

    const finalTextArr: string[] = [];
    for (const key of Object.keys(finalText).sort((a,b) => +a-+b)) {
      finalTextArr.push(finalText[key]);
    }

    // do autocorrect
    for (const toCorrect in autocorrect) {
      const correct = autocorrect[toCorrect];
      for (let div = 0; div < finalTextArr.length; div++) {
        finalTextArr[div] = finalTextArr[div].replaceAll(toCorrect, correct);
      }
    }

    if (disregardHeader) {
      for (let div = 0; div < finalTextArr.length; div++) {
        finalTextArr[div] = finalTextArr[div].split("\n").slice(1).join("\n"); // remove first line
      }
    }

    // not prompt
    if (utpSet.size != 0) {
      const invAutocorrect: Record<string,string> = {};
      for (const key in autocorrect) { invAutocorrect[autocorrect[key]] = key; }

      for (let div = 0; div < finalTextArr.length; div++) {
        const lines = finalTextArr[div].split("\n");
        for (let lineI = 0; lineI < lines.length; lineI++) {
          const line = lines[lineI];
          for (let charI = 0; charI < line.length; charI++) {
            
            // check if just started on a portion garunteed correct by autocorrect; no need to get user to check
            let didSkip = false;
            for (const corrected in invAutocorrect) {
              if (line.substring(charI, charI + corrected.length) == corrected) {
                charI += corrected.length-1;
                didSkip = true;
                break;
              }
            }
            if (didSkip) continue;

            const char = line[charI];
            if (!utpSet.has(char)) continue; // char can be safely ignored

            const formattedLine = line.substring(0, charI) + `\x1b[33m\x1b[4m${char}\x1b[0m` + line.substring(charI+1);
            if (lineI > 1) console.log(lines[lineI - 2]);
            if (lineI > 0) console.log(lines[lineI - 1]);
            console.log(formattedLine);
            const out = prompt(`Is \"${char}\" correct? (Enter to skip): `);
            if (out && out.length > 0 && out[0] != char) lines[lineI] = line.substring(0,charI) + out[0] + line.substring(charI+1);
          }
        }
        finalTextArr[div] = lines.join("\n");
      }
    }
    
    const text = finalTextArr.join(seperator);

    fs.writeFile(__dirname + "/../io/output/" + outfilename, text, (err) => {
      if (err) console.error(err);

      resolve("Ok.");
    });
  });
}

function escapeRegExp(stringToGoIntoTheRegex: string) { // thank you github!
  return stringToGoIntoTheRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
