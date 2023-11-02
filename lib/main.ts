import Jimp = require("jimp");

import { appendToName, getAllFiles, toAbsoluteInput, toAbsoluteOutput } from "./fsExt.js";
import { denoise, destring, highlightLines, horizontalPrune, simplify } from "./jimpable.js";
import { lap, startTimer } from "./timer.js";

export function main(args: string[], namedArgs: Record<string,string>) {
  if (args.length == 0) { // read all
    args = getAllFiles(["png"]);
  }
  // args = args.map((filename) => { return toAbsoluteInput(filename); }); // convert to absolute path

  const start = (new Date()).getTime();
  const promises: Promise<string>[] = [];
  for (const filename of args) {
    console.log(`: Processing [${filename}]`);
    promises.push(
      new Promise<string>((resolve,reject) => {
        doConversion(
          toAbsoluteInput(filename),
          toAbsoluteOutput(filename),
          filename
        ).then((result) => {
          console.log(`: Completed [${filename}] with output of \"${result}\"`);
          resolve(result);
        }).catch(err => { reject(err); })
      })
    );
  }

  Promise.all(promises).then(result => {
    const end = (new Date()).getTime();
    const delta = Math.round((end - start) / 10) / 100

    console.log(`::Processed ${args.length} ${args.length == 1 ? "file" : "files"} in ${delta}s`);
  }).catch(err => { console.error(err); })
}

function doConversion(
  input: string,
  output: string,
  name: string
) {
  return new Promise<string>((resolve,reject) => {
    try {
      startTimer();
      Jimp.read(input, (err,img) => {
        writeMessage(`Successfully read`, name);

        const simplified = simplify(img);
        writeMessage("simplified", name);
        const destrung = destring(simplified.clone());
        writeMessage("destrung", name);
        const denoised = denoise(destrung.clone());
        writeMessage("denoised", name);
        const pruned = horizontalPrune(denoised.clone());
        writeMessage("pruned", name);
        const detected = highlightLines(pruned.clone());
        writeMessage("highlighted", name)
        
        detected.write(output)

        resolve("Ok.");
      });
    }
    catch(err) { reject(err.toString()); }
  });
}

function writeMessage(
  message: string,
  name: string
) {
  const time = lap();
  const timeStr = `${Math.round(time / 10) / 100}s`;
  console.log(`: ${message} [\x1b[36m${name}\x1b[0m] (\x1b[33m${timeStr}\x1b[0m)`);
}
