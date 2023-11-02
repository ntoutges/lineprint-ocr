import Jimp = require("jimp");

import { getSetting } from "./settings.js";
import { floodFill, floodFillAdd, floodFillUntil } from "./floodable.js";
import { getAverageCharBounds, getLineCharBounds, getLineFirstCharBounds } from "./boundable.js";
import { categorizeRegions, getPrunableRegions, getRegions, groupRegions, prunePrunableRegions } from "./prunable.js";

export function simplify(img: Jimp) {
  const rWeight = getSetting<number>("simplify.weights.r");
  const gWeight = getSetting<number>("simplify.weights.g");
  const bWeight = getSetting<number>("simplify.weights.b");
  const threshold = getSetting<number>("simplify.threshold");
  
  const baseWeight = getSetting<number>("simplify.weights.base");

  let base = 0;
  if (baseWeight != 0) { // used to adjust for lighting
    let pixelCt = img.bitmap.width * img.bitmap.height;
    let total = 0n; // bigint to handle massive values
    img.scan(0,0, img.bitmap.width, img.bitmap.height, (x,y,idx) => {
      const r = img.bitmap.data[idx+0] * rWeight;
      const g = img.bitmap.data[idx+1] * gWeight;
      const b = img.bitmap.data[idx+2] * bWeight;
      const sum = r + g + b;

      total += BigInt(Math.round(sum * baseWeight));
    });

    base = Number(total / BigInt(pixelCt))
  }

  const width = img.bitmap.width
  const height = img.bitmap.height;
  img.scan(0,0, width, height, (x,y,idx) => {
    const r = img.bitmap.data[idx+0] * rWeight;
    const g = img.bitmap.data[idx+1] * gWeight;
    const b = img.bitmap.data[idx+2] * bWeight;


    if ((r + g + b) - base < threshold) { // under threshold, convert to 0s
      img.bitmap.data[idx+0] = 0;
      img.bitmap.data[idx+1] = 0;
      img.bitmap.data[idx+2] = 0;
    }
    else { // above threshold, convert to 255s
      img.bitmap.data[idx+0] = 0xFF;
      img.bitmap.data[idx+1] = 0xFF;
      img.bitmap.data[idx+2] = 0xFF;
    }
  });
  return img;
}

// remove stray dots of white or black
export function denoise(img: Jimp) {
  const limit = getSetting<number>("denoise.limit"); // convert proportion to value
  const fillBorders = getSetting<number>("denoise.autofill-borders"); // skip check for necessary size of flood fill
  
  const width = img.bitmap.width;
  const height = img.bitmap.height;

  const blacklist = new Set<number>();
  img.scan(0,0, width, height, (x,y,idx) => {
    if (img.bitmap.data[idx] != 0) return; // skip white pixels, not important
    if (blacklist.has(x + y*width)) {
      return;
    }
    
    const skip = fillBorders && (x < fillBorders || y < fillBorders || x >= width-fillBorders || y >= height-fillBorders);
    
    if (skip || floodFillUntil(img, x,y,limit) > 0) { // flood fill couldn't fill all
      floodFill(img, x,y);
    }
    else floodFillAdd(img, x,y, blacklist);
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

// look for top-left (pure) black px
export function highlightLines(img: Jimp) {
  const firstBounds = getLineCharBounds(img, 0,img.bitmap.height);
  const avgChar = getAverageCharBounds(firstBounds);

  const boundsList = getLineFirstCharBounds(img, avgChar);

  // for (const boundsLine of boundsList) {
    for (const bounds of boundsList) {
      img.scan(bounds.x, bounds.y, bounds.w,bounds.h, (x,y,idx) => {
        if (img.bitmap.data[idx] != 0) {
          setPixelAt(img, x,y, 0xA0);
        }
      });
      
      for (let x = bounds.x; x <= bounds.x2; x++) {
        setPixelAt(img, x,bounds.y, 0xFF, true);
        setPixelAt(img, x,bounds.y2, 0xFF, true);
      }
      for (let y = bounds.y; y <= bounds.y2; y++) {
        setPixelAt(img, bounds.x,y, 0xFF, true);
        setPixelAt(img, bounds.x2,y, 0xFF, true);
      }
    }
  // }

  return img;
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
