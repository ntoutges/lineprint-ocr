import Jimp = require("jimp");
const fs = require("fs");

import { appendToName, extensionless, getAllFiles, setExt, toAbsoluteInput, toAbsoluteOutput } from "./fsExt.js";
import { denoise, destring, getCharTokens, highlightChars, horizontalPrune, simplify } from "./jimpable.js";
import { lap, startTimer } from "./timer.js";
import { getSetting } from "./settings.js";
import { toText } from "./textable.js";
import { categorizeTokens, fillKnownTokens, fillTokenImages, writeCategorizedImages, writeTokenImages } from "./tokenable.js";
import { addToTrainingDataset, constructTrainingDataset, recognizeFromTrainingDataset } from "./trainable.js";
import { TokenText, doPostProcess, doPostProcess2 } from "./postprocessable.js";
import { addToCombo, finalizeCombo } from "./combinator.js";
import { getTilt } from "./boundable.js";

export function main(args: string[], namedArgs: Record<string,string>) {
  if (args.length == 0) { // read all
    args = getAllFiles(["png"]);
  }

  if ("text" in namedArgs) {
    console.log("Starting post-post processing");
    doPostPostProcess(args);
    return;
  }

  let inFolder = getSetting<string>("general.infolder").replace(/\/$/g, ""); // remove possible trailing "/"
  if (inFolder.trim().length == 0) inFolder = __dirname + "/../io/input";
  
  const start = (new Date()).getTime();
  const promises: Promise<string>[] = [];
  let index = 0;
  for (const filename of args) {
    console.log(`: Processing [${filename}]`);
    promises.push(
      new Promise<string>((resolve,reject) => {
        doConversion(
          toAbsoluteInput(filename, inFolder),
          toAbsoluteOutput(filename),
          filename,
          index++,
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

    const doCombo = getSetting<boolean>("combination.do-combination");

    if ("train" in namedArgs) {
      console.log(": Constructing training dataset");
      const output = await constructTrainingDataset();
      console.log(`::Constructed training dataset with output of \"${output}\"`);
    }
    else  if (doCombo) {
      console.log(": Writing combination file");
      finalizeCombo().then((result) => {
        console.log("Finished!");
        const outfile = getSetting<string>("combination.outfile");
        doPostPostProcess([outfile]);
      });
    }
  }).catch(err => { console.error(err); })
}

function doConversion(
  input: string,
  output: string,
  name: string,
  index: number,
  namedArgs: Record<string,string>
) {
  const doCombo = getSetting<boolean>("combination.do-combination");

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
          writeMessage("highlighted", name);
          bounded.write(output);
          writeMessage("wrote highlighted", name)
        }

        const doSeparate = getSetting<boolean>("recognition.do-separate");
        if (!doSeparate) { // don't separate characters into individual images (this takes a LONG time); testing
          resolve("Ok.");
          return;
        }
        // NOTE: this program cannot work when the first character is not full (ie: ;/:)
        fillTokenImages(destrung, tokens);
        writeMessage("separated images", name)
        
        if ("train" in namedArgs) {
          try {
            const txtFile = setExt(input, "txt");
            fillKnownTokens(tokens, fs.readFileSync(txtFile).toString());
            const categorized = categorizeTokens(tokens);

            // writeCategorizedImages(__dirname + "/../io/output/training", categorized);
            // writeMessage("wrote images", name);
            
            addToTrainingDataset(categorized);
            
            resolve("Imported Characters.");
          }
          catch(err) {
            resolve(err.toString());
          }
        }
        else {
          const doRecognition = getSetting<boolean>("recognition.do-recognition");
          if (!doRecognition) { // don't do recognition (takes a LONG time)
            resolve("Ok");
            return;
          }

          recognizeFromTrainingDataset(tokens).then(tokens => {
            const tokenText = new TokenText(tokens);
            doPostProcess(tokenText);

            // writeTokenImages(__dirname + "/../io/output/preview", tokens); // print out formated characters; testing
            writeMessage("compared characters", name);

            const doOutputIndividual = getSetting<boolean>("recognition.doOutputIndividual");

            const str = tokenText.toString();
            if (doOutputIndividual) fs.writeFileSync(setExt(output, "txt"), str); // don't write output file if learning
            if (doCombo) addToCombo(index, str);

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

function doPostPostProcess(infiles: string[]) {
  for (const filename of infiles) {
    console.log(`Post-post processing ${filename}`);
    const text = fs.readFileSync(__dirname + "/../io/output/" + filename, { encoding: 'utf8', flag: 'r' }).toString();
    const newText = doPostProcess2(text);
    fs.writeFileSync(__dirname + "/../io/postoutput/" + filename, newText);
  }
}