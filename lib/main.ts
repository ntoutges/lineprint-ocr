import Jimp = require("jimp");

import { appendToName, getAllFiles, toAbsoluteInput, toAbsoluteOutput } from "./fsExt.js";
import { denoise, destring, highlightLines, horizontalPrune, simplify } from "./jimpable.js";

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
      Jimp.read(input, (err,img) => {
        console.log(`: Successfully read [${name}]`);

        const simplified = simplify(img);
        console.log(":>simplified");
        const destrung = destring(simplified.clone());
        console.log(":>destrung");
        const denoised = denoise(destrung.clone());
        console.log(":>denoised");
        const pruned = horizontalPrune(denoised.clone());
        console.log(":>pruned");
        const detected = highlightLines(pruned.clone());
        console.log(":>highlighted")
        
        // simplified.write(output);
        // destrung.write(appendToName(output, "1"));
        // denoised.write(appendToName(output, "2"));
        // pruned.write(appendToName(output,"3"));
        detected.write(appendToName(output, "4"))

        resolve("Ok.");
      });
    }
    catch(err) { reject(err.toString()); }
  });
}