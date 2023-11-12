import Jimp = require("jimp");
const fs = require("fs");

import { appendToName, extensionless, getAllFiles, setExt, toAbsoluteInput, toAbsoluteOutput } from "./fsExt.js";
import { denoise, destring, getCharTokens, highlightChars, horizontalPrune, simplify, whitewashRed } from "./jimpable.js";
import { lap, startTimer } from "./timer.js";
import { getSetting } from "./settings.js";
import { toText } from "./textable.js";
import { categorizeTokens, fillKnownTokens, fillTokenImages, writeCategorizedImages, writeTokenImages } from "./tokenable.js";
import { addToTrainingDataset, constructTrainingDataset, recognizeFromTrainingDataset } from "./trainable.js";
import { TokenText, doPostProcess, doPostProcess2 } from "./postprocessable.js";
import { addToCombo, finalizeCombo } from "./combinator.js";
import { getTilt } from "./boundable.js";

const batchPattern = /(\d+)\s*\/\s*(\d+)/
export async function main(args: string[], namedArgs: Record<string,string>) {
  let inFolder = getSetting<string>("general.infolder").replace(/\/$/g, ""); // remove possible trailing "/"
  let outModifier = "";
  if (inFolder.trim().length == 0) inFolder = __dirname + "/../io/input";
  
  if (args.length == 0) { // read all
    args = getAllFiles(["png"], inFolder);

    if ("batch" in namedArgs) {
      const batchData = namedArgs.batch.match(batchPattern);
      if (!batchData) {
        console.log(`Could not interpret \"${namedArgs.batch}\" as batch data. Use format <batch #>/<total batches>`);
        return;
      }
      const batchNum = +batchData[1];
      const batchTotal = +batchData[2];

      outModifier = batchData[1];

      const startI = Math.floor(args.length * (batchNum-1) / batchTotal);
      const endI = Math.floor(args.length * batchNum / batchTotal);
      const amount = endI-startI-1;
      const portion = Math.round(1000 * amount / args.length) / 10;

      console.log(`Batch #${batchNum} processing ${amount}/${args.length} images, (\x1b[36m${portion}%\x1b[0m) images`);
      args = args.slice(startI, endI);
    }
  }

  if ("text" in namedArgs) {
    console.log("Starting post-post processing");
    doPostPostProcess(args);
    return;
  }
  
  const start = (new Date()).getTime();
  let index = 0;
  for (const filename of args) {
    console.log(`: Processing [${filename}]`);
    const result = await doConversion(
      toAbsoluteInput(filename, inFolder),
      toAbsoluteOutput(filename),
      filename,
      index++,
      namedArgs
    );
    console.log(`: Completed [${filename}] with output of \"${result}\"`);
  }

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
    const outfile = appendToName(getSetting<string>("combination.outfile"), outModifier);
    finalizeCombo(outfile).then((result) => {
      console.log("Finished!");
      doPostPostProcess([outfile]);
    });
  }
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

        const whitewashed = whitewashRed(img);
        writeMessage("whitewashed", name);
        const simplified = simplify(whitewashed);
        writeMessage("simplified", name);
        const destrung = destring(simplified);
        writeMessage("destrung", name);
        const denoised = denoise(destrung);
        writeMessage("denoised", name);
        const pruned = horizontalPrune(denoised);
        writeMessage("pruned", name);

        const tokens = getCharTokens(pruned);
        writeMessage("tokenized", name);

        if (getSetting("charHighlight.doOutputBounds") && !getSetting("charHighlight.doOutputAfterPostProcess")) {
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
        writeMessage("separated images", name);
        
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
            const tokenText = new TokenText(tokens, pruned);
            doPostProcess(tokenText);
            writeMessage("Post-Processed", name);

            if (getSetting("charHighlight.doOutputBounds") && getSetting("charHighlight.doOutputAfterPostProcess")) {
              const bounded = highlightChars(destrung.clone(), tokenText.tokens);
              writeMessage("highlighted", name);
              bounded.write(output);
              writeMessage("wrote highlighted", name);
            }

            // writeTokenImages(__dirname + "/../io/output/preview", tokens); // print out formated characters; testing
            writeMessage("compared characters", name);

            const doOutputIndividual = getSetting<boolean>("recognition.doOutputIndividual");

            const str = tokenText.toString();
            if (doOutputIndividual) fs.writeFileSync(setExt(output, "txt"), str); // don't write output file if learning
            if (doCombo) addToCombo(index, str);

            // writeTokenImages(__dirname + "/../io/output/test", tokens); // testing

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
  const timeStr = `${(Math.round(time / 10) / 100).toFixed(2)}s`;
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