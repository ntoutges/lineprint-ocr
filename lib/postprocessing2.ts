const prompt = require("prompt-sync")({ sigint:true  });

export const steps2: Record<string, (input: string, settings: Record<string,any>) => string> = {
  "$ recognition": dollarSignRecognition,
  "Semicolon Remnant Removal": SRR,
  "format": format,
  "trim trailing spaces": trimTrailingSpaces,
  "trim empty lines": trimEmptyLines,
  "prune noise": pruneNoise,
  "prompt garbage": promptGarbage
}

// user defined functions for application-specific task

// replace =S<hex> with =$<some hex>(space)
const dollarSignRecognitionPattern = /([= ']|^)S(?=[\dABCDEF]+([ ']|$))/gim;
function dollarSignRecognition(input: string, settings: Record<string,any>) {
  return input.replace(dollarSignRecognitionPattern, "$1$"); // replace all S with $ (in accordance with previous pattern)
}

const SRRPattern = / +'( +|$)/gm;
function SRR(input: string, settings: Record<string,any>) { // remove ' that may come from the bottom of a semicolon
  return input.replace(SRRPattern, "");
}

// const sectionPattern = /( \s*|^).+?((?=  | \w+?:)|$)/gi;
const sectionPattern = /( \s+|^).+?((?=  )|$)/gi;
function format(input: string, settings: Record<string,any>) {
  const lines = input.split("\n");
  const sections = settings.sections as number[];
  const wriggleRoom = settings["wriggle-room"] as number;

  
  for (const i in lines) {
    const formatedSections: Record<number, string[]> = {};
    for (const space of lines[i].matchAll(sectionPattern)) {
      const startPos = space.index + space[1].length;
      const chars = space[0].replace(/^ +/g, "");

      let sectionMinBound = sections[sections.length-1] ?? 0;
      for (const section of sections) {
        if (section + wriggleRoom >= startPos) {
          sectionMinBound = section;
          break;
        }
      }

      if (!(sectionMinBound in formatedSections)) formatedSections[sectionMinBound] = [];
      formatedSections[sectionMinBound].push(chars);
    }

    // do actual formatting based on data from previous block of code
    let workingStr = "";
    let isFirst = true;
    for (let i in formatedSections) {
      workingStr = (workingStr + (isFirst ? "" : " ")).padEnd(+i, " "); // garuntees at least one space between current section and next
      workingStr += formatedSections[i].join(" ");
      isFirst = false;
    }
    lines[i] = workingStr;
  }

  return lines.join("\n");
}

const spacePattern = / +$/gm;
function trimTrailingSpaces(input: string, settings: Record<string,any>) {
  return input.replace(spacePattern, "");
}

const emptyLinePattern = /\n+(?=\n)/gm;
function trimEmptyLines(input: string, settings: Record<string,any>) {
  return input.replace(emptyLinePattern, "");
}

function pruneNoise(input: string, settings: Record<string,any>) {
  const pattern = new RegExp(`(^| )(?:[${settings.noise}])( |$)`, "gm");
  return input.replace(pattern, "$1 $2");
}

const garbagePattern = /[\w\d]/g;
function promptGarbage(input: string, settings: Record<string,any>) {
  const minPortion = settings.portion as number;
  const lines = input.split("\n");
  
  // let total = 0;
  // for (const i in lines) {
  //   const line = lines[i];
  //   const spaceless = line.replace(/\s/g, "");
  //   const garbage = spaceless.replace(garbagePattern, ""); // remove non-garbage
  //   const portion = garbage.length / spaceless.length;

  //   if (portion > minPortion) {
  //     total++;
  //   }
  // }
  
  // let current = 0;
  for (const i in lines) {
    const line = lines[i];
    const spaceless = line.replace(/\s/g, "");
    if (spaceless.length == 0) continue;

    const garbage = spaceless.replace(garbagePattern, ""); // remove non-garbage
    const portion = garbage.length / spaceless.length;

    if (portion > minPortion) {
      // if (+i > 1) console.log(lines[+i-2]);
      // if (+i > 0) console.log(lines[+i-1]);
      console.log(`(${+i+1}) \x1b[36m${line}\x1b[0m\n`);
      // if (+i < lines.length-1) console.log(lines[+i+1]);

      // const newL = prompt(`What is this line? (${++current}/${total}): `);
      // if (newL == "") continue; // ignore
      // lines[i] = newL;
    }
  }
  return lines.join("\n");
}