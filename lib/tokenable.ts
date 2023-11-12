import Jimp = require("jimp");
import { Bounds } from "./floodable.js";
const fs = require("fs");

export function getTextOrigion(
  boundsList: Bounds[][]
) {
  const leftMost = getLeftmostBound(boundsList);
  const topMost = getTopmostBound(boundsList);

  return {
    x: leftMost.x,
    y: topMost.y
  }
}

export function getLeftmostBound(
  boundsList: Bounds[][]
) {
  let minBound: Bounds = null;
  for (const line of boundsList) {
    const firstBound = line[0];
    if (!minBound || firstBound.x < minBound.x) {
      minBound = firstBound;
    }
  }
  return minBound;
}

export function getTopmostBound(
  boundsList: Bounds[][]
) {
  let minBound: Bounds = null;
  for (const line of boundsList) {
    const firstBound = line[0];
    if (!minBound || firstBound.y < minBound.y) {
      minBound = firstBound;
    }
  }
  return minBound;
}

export type Token = {
  bounds: Bounds,
  value: string,
  img?: Jimp,
  center: {
    x: number,
    y: number
  },
  distances: Record<string, number>,
  adistance: number // absolute distance
}

export function tokenizeBounds(
  boundsList: Bounds[][],
  origin: { x: number, y: number },
  avgCharSize: { w: number, h: number }
) {
  const tokens: Token[][] = [];

  let lastCharY = origin.y - avgCharSize.h; // as if first char hasn't yet been printed
  for (const line of boundsList) {
    if (line.length == 0) continue; // ignore empty list

    // add in extra "newlines"
    const firstChar = line[0];
    const gapY = firstChar.y - lastCharY;
    const heightFactor = Math.round(gapY / avgCharSize.h); // this should be 0/1 for no space, then 2+ for 1+ spaces
    lastCharY = firstChar.y;
    for (let j = 1; j < heightFactor; j++) { // loop [heightFactor-1] times
      tokens.push([]); // no chars needed--empty line
    }

    let lastCharX = origin.x - avgCharSize.w; // as if first char hasn't yet been printed
    const localTokens: Token[] = [];
    for (let i = 0; i < line.length; i++) {
      const bounds = line[i];
      const gap = bounds.x - lastCharX;
      const widthFactor = Math.round(gap / avgCharSize.w); // this should be 0/1 for no space, then 2+ for 1+ spaces
      
      // push spaces
      const step = gap / widthFactor;
      for (let j = 1; j < widthFactor; j++) { // loop [widthFactor-1] times
        const x1 = Math.round(lastCharX + step * j) + 1;
        const x2 = Math.round(lastCharX + step * (j+1)) - 1;
        localTokens.push({
          bounds: {
            w: x2 - x1,
            h: avgCharSize.h,
            x: x1,
            x2: x2, // separates bounds
            y: bounds.y,
            y2: bounds.y + avgCharSize.h
          },
          value: " ", // value is known,
          center: { // value doesn't actually matter
            x: 0,
            y: 0
          },
          distances: {},
          adistance: 0
        });
      }

      // push actual character
      localTokens.push({
        bounds,
        value: null, // value unknown
        center: null,
        distances: {},
        adistance: 0
      });

      lastCharX = bounds.x;
    }
    tokens.push(localTokens);
  }

  return tokens;
}

export function fillTokenImages(img: Jimp, tokens: Token[][]) {
  let i = 0;
  const lineCt = Object.keys(tokens).length;
  for (const line of tokens) {
    process.stdout.write(`: Separating Characters | ${++i}/${lineCt} lines processed\r`);
    for (const token of line) {
      if (token.value != null) continue; // only retrieve those whose value is unknown
      token.img = img.clone().crop(
        token.bounds.x,
        token.bounds.y,
        token.bounds.w,
        token.bounds.h
      );

      let xWeight = 0;
      let yWeight = 0;
      let total = 0;
      token.img.scan(0,0, token.img.bitmap.width, token.img.bitmap.height, (x,y,idx) => {
        if (token.img.bitmap.data[idx] == 0xFF) return; // ignore
        // add weights
        xWeight += x;
        yWeight += y;
        total++;
      });

      
      token.center = {
        x: Math.floor(xWeight / total),
        y: Math.floor(yWeight / total)
      };
    }
  }
  console.log(""); // new line

  return tokens; // in case I ever want the function to be daisy-chained
}

export function fillKnownTokens(
  tokens: Token[][],
  text: string
) {
  // remove spaces/empty lines from text (they serve no purpose, besides formatting when initially putting in text); split into lines
  const textLines = text.replace(/ +|\r|/g, "").replace(/\n\n+/g, "\n").split("\n");
  let line = 0;
  for (const i in tokens) {
    if (tokens[i].length == 0) continue; // ignore line
    if (line >= textLines.length) {
      console.log(`WARNING: known text has less lines than tokens implies. ${line+1} vs ${textLines.length}`);
      break; // out of known text
    }

    if (textLines[line]?.trim() == "/**/") { // skip
      console.log(`Skipping line #${line+1}`);
      line++;
      continue;
    }
    
    let index = 0;
    for (const j in tokens[i]) {
      if (tokens[i][j].value == " ") continue; // skip spaces
      if (index >= textLines[line].length) {
        console.log(`WARNING: known text on line [${line+1}] (${textLines[line]}) has less chars than tokens implies.`);
        break;
      }
      const knownChar = textLines[line][index];
      tokens[i][j].value = knownChar;
      index++;
    }
    if (index < textLines[line].length) {
      console.log(`WARNING: known text on line [${line+1}] (${textLines[line]}) has more chars than tokens implies.`);
      line++;
      continue;
    }
    line++;
  }

  if (line < textLines.length) {
    console.log(`WARNING: known text has more lines than tokens implies. ${line+1} vs ${textLines.length}`);
  }

  return tokens;
}

export function categorizeTokens(
  tokens: Token[][]
) {
  const categories: Record<string, Token[]> = {};
  for (const line of tokens) {
    for (const token of line) {
      if (token.value == null) continue; // ignore
      if (!(token.value in categories)) categories[token.value] = [];
      categories[token.value].push(token);
    }
  }

  return categories;
}

export function writeTokenImages(folder: string, tokens: Token[][]) {
  for (const line in tokens) {
    for (const i in tokens[line]) {
      const token = tokens[line][i];
      if (!token.img) continue;
      const txt = Object.keys(token.distances).sort((a,b) => token.distances[a] - token.distances[b]).map((value) => `${value}: ${token.distances[value]}`).join("\n");
      
      const distance = token.adistance;
      token.img.write(`${folder}/${line}/${i}_${distance}.png`);
      fs.writeFileSync(`${folder}/${line}/${i}_${distance}.txt`, txt);
    }
  }
}

export function writeCategorizedImages(folder: string, tokens: Record<string, Token[]>) {
  for (const char in tokens) {
    let i = 0;
    for (const token of tokens[char]) {
      if (!token.img) continue;
      const txt = Object.keys(token.distances).sort((a,b) => token.distances[a] - token.distances[b]).map((value) => `${value}: ${token.distances[value]}`).join("\n");

      token.img.write(`${folder}/${char.charCodeAt(0)}_${token.bounds.y}_${i++}.png`);
      fs.writeFileSync(`${folder}/${char.charCodeAt(0)}_${token.bounds.y}_${i++}.txt`, txt);
    }
  }
}