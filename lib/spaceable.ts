import Jimp = require("jimp");
import { Bounds } from "./floodable.js"

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
  img?: Jimp
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
      const step = Math.floor(gap / widthFactor);
      for (let j = 1; j < widthFactor; j++) { // loop [widthFactor-1] times
        const offX = Math.floor(step * j);
        localTokens.push({
          bounds: {
            w: step - 2,
            h: avgCharSize.h,
            x: lastCharX + offX,
            x2: lastCharX + offX + step - 2, // separates bounds
            y: bounds.y,
            y2: bounds.y + avgCharSize.h
          },
          value: " " // value is known
        });
      }

      // push actual character
      localTokens.push({
        bounds,
        value: null // value unknown
      });

      lastCharX = bounds.x;
    }
    tokens.push(localTokens);
  }

  return tokens;
}
