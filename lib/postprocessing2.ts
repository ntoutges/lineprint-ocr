export const steps2: Record<string, (input: string, settings: Record<string,any>) => string> = {
  "$ recognition": dollarSignRecognition,
  "format": format
}

// user defined functions for application-specific task

// replace =S<hex> with =$<some hex>(space)
const dollarSignRecognitionPattern = /S(?=[\dABCDEF]+ )/gi;
function dollarSignRecognition(input: string, settings: Record<string,any>) {
  return input.replace(dollarSignRecognitionPattern, "$"); // replace all S with $ (in accordance with previous pattern)
}

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
    for (let i in formatedSections) {
      workingStr = workingStr.padEnd(+i, " ");
      workingStr += formatedSections[i].join(" ");
    }
    lines[i] = workingStr
  }

  return lines.join("\n");
}
