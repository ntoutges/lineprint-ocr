import Jimp = require("jimp");
const fs = require("fs");

import { appendToName, extensionless, getAllFiles, setExt, toAbsoluteInput, toAbsoluteOutput } from "./fsExt.js";
import { denoise, destring, getCharTokens, highlightChars, horizontalPrune, simplify } from "./jimpable.js";
import { lap, startTimer } from "./timer.js";
import { getSetting } from "./settings.js";
import { toText } from "./textable.js";
import { categorizeTokens, fillKnownTokens, fillTokenImages, writeCategorizedImages, writeTokenImages } from "./tokenable.js";
import { addToTrainingDataset, constructTrainingDataset, recognizeFromTrainingDataset } from "./trainable.js";

export function main(args: string[], namedArgs: Record<string,string>) {
  if (args.length == 0) { // read all
    args = getAllFiles(["png"]);
  }
  
  const start = (new Date()).getTime();
  const promises: Promise<string>[] = [];
  for (const filename of args) {
    console.log(`: Processing [${filename}]`);
    promises.push(
      new Promise<string>((resolve,reject) => {
        doConversion(
          toAbsoluteInput(filename),
          toAbsoluteOutput(filename),
          filename,
          namedArgs
        ).then((result) => {
          console.log(`: Completed [${filename}] with output of \"${result}\"`);
          resolve(result);
        }).catch(err => { reject(err); })
      })
    );
  }

  Promise.all(promises).then(async result => {
    const end = (new Date()).getTime();
    const delta = Math.round((end - start) / 10) / 100

    console.log(`::Processed ${args.length} ${args.length == 1 ? "file" : "files"} in ${delta}s`);

    if ("train" in namedArgs) {
      console.log(": Constructing training dataset");
      const output = await constructTrainingDataset();
      console.log(`::Constructed training dataset with output of \"${output}\"`);
    }
  }).catch(err => { console.error(err); })
}

function doConversion(
  input: string,
  output: string,
  name: string,
  namedArgs: Record<string,string>
) {
  return new Promise<string>((resolve,reject) => {
    try {
      startTimer();
      Jimp.read(input, (err,img) => {
        if (err) console.error(err);
        writeMessage(`successfully read`, name);

        const simplified = simplify(img);
        writeMessage("simplified", name);
        const destrung = destring(simplified.clone());
        writeMessage("destrung", name);
        const denoised = denoise(destrung.clone());
        writeMessage("denoised", name);
        const pruned = horizontalPrune(denoised.clone());
        writeMessage("pruned", name);

        const tokens = getCharTokens(pruned.clone());
        writeMessage("tokenized", name);

        if (getSetting("charHighlight.doOutputBounds")) {
          const bounded = highlightChars(destrung.clone(), tokens);
          writeMessage("highlighted", name)
          bounded.write(output)
        }

        fillTokenImages(destrung, tokens);
        writeMessage("separated images", name)
        
        if ("train" in namedArgs) {
          const txtFile = __dirname + "/../io/input/" + extensionless(name) + ".txt";
          fillKnownTokens(tokens, fs.readFileSync(txtFile).toString());
          const categorized = categorizeTokens(tokens);
          // writeCategorizedImages(__dirname + "/../io/output/training", categorized);
          writeMessage("wrote images", name);

          addToTrainingDataset(categorized);
          resolve("Training Complete.");
        }
        else {
          recognizeFromTrainingDataset(tokens).then(tokens => {
            // writeTokenImages(__dirname + "/../io/output/preview", tokens); // print out formated characters
            writeMessage("compared characters", name);
            fs.writeFileSync(setExt(output, "txt"), toText(tokens, "?")); // don't write output file if learning
            resolve("Ok.");
          });
        }

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
  console.log(`: [\x1b[36m${name}\x1b[0m] ${message} (\x1b[33m${timeStr}\x1b[0m)`);
}
