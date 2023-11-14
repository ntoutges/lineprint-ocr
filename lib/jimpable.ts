import Jimp = require("jimp");

import { getSetting } from "./settings.js";
import { Bounds, floodFill, floodFillAdd, floodFillBeyond, floodFillUntil } from "./floodable.js";
import { getAverageCharBounds, getLineCharBounds, getLineCharBoundsBlind, getLineFirstCharBounds, getTilt } from "./boundable.js";
import { categorizeRegions, getPrunableRegions, getRegions, groupRegions, prunePrunableRegions } from "./prunable.js";
import { Token, getLeftmostBound, getTextOrigion, tokenizeBounds } from "./tokenable.js";
import { basicThreshold, sauvola } from "./threshold.js";

export function simplify(img: Jimp) {
  const method = getSetting<string>("simplify.method");

  switch (method) {
    case "sauvola":
      return sauvola(
        img,
        getSetting<number>("simplify.sauvola.radius"),
        getSetting<number>("simplify.sauvola.R"),
        getSetting<number>("simplify.sauvola.k")
      );
    default:
      console.log(`Unknown simplify method: "${method}"; Reverting to "basic"`);
    case "basic":
      return basicThreshold(
        img,
        getSetting<number>("simplify.basic.base-weight"),
        getSetting<number>("simplify.basic.threshold")
      );
  }
  
  return img;
}

// remove stray dots of white or black
export function denoise(img: Jimp) {
  const limit = getSetting<number>("denoise.limit"); // convert proportion to value
  const fillBorders = getSetting<number>("denoise.autofill-borders"); // skip check for necessary size of flood fill
  
  const width = img.bitmap.width;
  const height = img.bitmap.height;

  const rightBorder = width-fillBorders-1;
  const bottomBorder = height-fillBorders-1;

  const blacklist = new Set<number>();
  img.scan(0,0, width, height, (x,y,idx) => {
    if (img.bitmap.data[idx] == 0xFF) return; // skip white pixels, not important
    if (blacklist.has(x + y*width)) {
      return;
    }
    
    const skip = fillBorders && (x < fillBorders || y < fillBorders || floodFillBeyond(img, x,y, rightBorder, bottomBorder));
    
    if (skip || floodFillUntil(img, x,y,limit) > 0) { // flood fill couldn't fill all
      floodFill(img, x,y);
    }
    else {
      floodFillAdd(img, x,y, blacklist);
    }
  });

  return img;
}

// get rid of noise surrounding characters
export function destring(img: Jimp) {
  const scanner = img.clone();
  scanner.scan(0,0, scanner.bitmap.width, scanner.bitmap.height, (x,y,idx) => {
    if (scanner.bitmap.data[idx] != 0) return; // not a black pixel

    // get surrounding pixel values
    const up = getPixelAt(scanner, x,y-1, 0xff);
    const down = getPixelAt(scanner, x,y+1, 0xff);
    const left = getPixelAt(scanner, x-1,y, 0xff);
    const right = getPixelAt(scanner, x+1,y, 0xff);

    const isSurrounded = (up + down + left + right) == 0;
    if (!isSurrounded) { // remove this pixel
      setPixelAt(img, x,y, 0xFF);
    }
  });
  return img;
}

// remove pixels where: above is a "thick" region, below is a "thick" region, and between is a "thin" region
export function horizontalPrune(img: Jimp) {
  const debug = getSetting<Record<string,boolean>>("horizontalPrune.debug");
  const doDenoise = getSetting<boolean>("horizontalPrune.doDenoise");

  const {thickRegions, thinRegions} = getRegions(img);

  // highlight thin regions
  if (debug["highlight-thins"]) {
    for (const region of thinRegions) {
      img.scan(region.x,region.y,region.w,1, (x,y,idx) => {
        setPixelAt(img, x,y, 0x80);
      });
    }
  }

  // highlight thick regions
  if (debug["highlight-thicks"]) {
    for (const region of thickRegions) {
      img.scan(region.x,region.y,region.w,1, (x,y,idx) => {
        setPixelAt(img, x,y, 0x80, true);
      });
    }
  }

  const thickRegionC = categorizeRegions(thickRegions);
  const thinRegionC = categorizeRegions(thinRegions);
  const thickRegionG = groupRegions(thickRegionC);
  
  const pruningRegionFinalists = getPrunableRegions(
    thickRegionG,
    thinRegionC
  );
    
  const pruningRegions = prunePrunableRegions(
    img,
    pruningRegionFinalists
  );

  // highlight finalist regions
  if (debug["highlight-finalists"]) {
    for (const y in pruningRegions) {
      for (const region of pruningRegions[y]) {
        img.scan(region.x,region.y,region.w,1, (x,y,idx) => {
          setPixelAt(img, x,y, 0xFF, true);
        });
      }
    }
  }
  else { // not debugging this
    for (const y in pruningRegions) {
      for (const region of pruningRegions[y]) {
        img.scan(region.x,region.y,region.w,1, (x,y,idx) => {
          setPixelAt(img, x,y, 0xFF); // turn to white
        });
      }
    }
  }

  if (doDenoise) return denoise(img);
  return img;
}

// more for testing than anything else
export function highlightChars(img: Jimp, tokens: Token[][]) {
  const highlightSpaces = getSetting<boolean>("charHighlight.doHighlightSpace");
  for (const line of tokens) {
    for (const token of line) {
      if (token.value != " ") {
        img.scan(token.bounds.x, token.bounds.y, token.bounds.w,token.bounds.h, (x,y,idx) => {
          if (img.bitmap.data[idx] == 0xFF && img.bitmap.data[idx+1] == 0xFF && img.bitmap.data[idx+2] == 0xFF) {
            // replace white
            setPixelAt(img, x,y, 0xA0);
          }
        });
      }
      else if (!highlightSpaces) continue;
      
      for (let x = token.bounds.x; x <= token.bounds.x2; x++) {
        setPixelAt(img, x,token.bounds.y, 0xFF, true);
        setPixelAt(img, x,token.bounds.y2, 0xFF, true);
      }
      for (let y = token.bounds.y; y <= token.bounds.y2; y++) {
        setPixelAt(img, token.bounds.x,y, 0xFF, true);
        setPixelAt(img, token.bounds.x2,y, 0xFF, true);
      }
    }
  }

  return img;
}

export function getCharTokens(img: Jimp) {
  const bounds = getSetting<{x:number, y:number}>("charBounds.charSize");
  const maxX = Math.round(getSetting<number>("charBounds.max-x-portion") * img.bitmap.width);
  
  let avgChar = {
    w: Math.round(bounds.x),
    h: Math.round(bounds.y)
  };
  if (bounds.x == 0 && bounds.y == 0) {
    const ySpaceRatio = getSetting<number>("charSize.y-spacing");

    const firstBounds = getLineCharBoundsBlind(img, 0,img.bitmap.height);
    avgChar = getAverageCharBounds(firstBounds);
    avgChar.h = Math.round(avgChar.h * ySpaceRatio);
    console.log("Character Bounds: ", avgChar)
  }

  const firstCharBoundsList = getLineFirstCharBounds(img, avgChar, maxX);
  const firstBounds = getLineCharBounds( // get line to find tilt from
    img,avgChar,
    firstCharBoundsList[0],[],0,
    null,
    "individual"
  ).bounds;

  const tilt = getTilt(firstBounds);
  // console.log(`Found tilt of slope: ${tilt.toFixed(6)}`);
  
  let lastLine = null;
  const boundsList: Bounds[][] = [];
  for (const firstCharBounds of firstCharBoundsList) {
    const { bounds, line } = getLineCharBounds(
      img,
      avgChar,
      firstCharBounds,
      boundsList[boundsList.length-1] ?? [],
      tilt, lastLine
    )
    lastLine = line;
    boundsList.push(bounds)
  }

  const origin = getTextOrigion(boundsList);
  const tokens = tokenizeBounds(boundsList, origin, avgChar);

  return tokens;
}

export function getPixelAt(
  img: Jimp,
  x: number,
  y: number,
  fallback: number = 0xFF
) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) {
    return fallback;
  }
  
  const idx = 4 * (x + img.bitmap.width * y); // 4 entries per pixel
  return img.bitmap.data[idx];
}

export function setPixelAt(
  img: Jimp,
  x: number,
  y: number,
  value: number,
  highlight: boolean = false
) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  
  const idx = 4 * (x + img.bitmap.width * y); // 4 entries per pixel
  img.bitmap.data[idx+0] = value;
  img.bitmap.data[idx+1] = value * +!highlight;
  img.bitmap.data[idx+2] = value * +!highlight;
}

export function shift(
  img: Jimp,
  x: number,
  y: number
) {
  const offset = 4 * (x + y*img.bitmap.width);

  const shifted = img.clone();
  shifted.scan(0,0, shifted.bitmap.width, shifted.bitmap.height, (x,y,idx) => {
    if (idx < offset) { // out of bounds, write as white
      shifted.bitmap.data[idx+0] = 0xFF;
      shifted.bitmap.data[idx+1] = 0xFF;
      shifted.bitmap.data[idx+2] = 0xFF;
    }
    else {
      const value = img.bitmap.data[idx-offset];
      shifted.bitmap.data[idx+0] = value;
      shifted.bitmap.data[idx+1] = value;
      shifted.bitmap.data[idx+2] = value;
    }
  });

  return shifted;
}