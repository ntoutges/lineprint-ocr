import { Token } from "./tokenable";
const fs = require("fs");

const allTokens: Record<string, Token[]> = {};
export function addToTrainingDataset( tokens: Record<string, Token[]> ) {
  for (const char in tokens) {
    if (!(char in allTokens)) allTokens[char] = [];
    allTokens[char] = allTokens[char].concat(tokens[char]);
  }
}

export function constructTrainingDataset(mode: string) {
  return new Promise((resolve, reject) => {
    const files = fs.readdirsync(__dirname + "/../io/training");
    const promises: Promise<any>[] = [];
    for (const filename of files) {
      promises.push(
        new Promise(resolve => {
          fs.unlink(__dirname + "/../io/training/" + filename, resolve);
        })
      )
    }

    Promise.all(promises).then(() => {
      
      resolve("Ok.");
    }).catch(err => { reject(err); });
  });
}