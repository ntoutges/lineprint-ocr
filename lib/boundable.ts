import Jimp = require("jimp");
import { Bounds, floodFillAdd, floodFillBounds } from "./floodable.js";
import { getSetting } from "./settings.js";
import { getPixelAt } from "./jimpable.js";

export function getLineCharBounds(
  img: Jimp,
  avgCharBounds: { w: number, h: number },
  firstCharBounds: Bounds,
  lastCharBoundsList: Bounds[]
): Bounds[] {
  const boundsList: Bounds[] = [firstCharBounds];
  const yBuffer = getSetting<number>("charBounds.yBuffer.individual");
  const vLookaroundU = getSetting<number>("charBounds.lookaround.vertical-up");
  const vLookaroundD = getSetting<number>("charBounds.lookaround.vertical-down");
  const hLookaround = getSetting<number>("charBounds.lookaround.horizontal");

  const maxX = img.bitmap.width;

  let lastCharBounds: Bounds = firstCharBounds;
  for (let i = 0; i < 200; i++) { // while(true), with built in limit
    const minX = lastCharBounds.x2 + 1;
    
    const midpoint = lastCharBounds.y + Math.floor(lastCharBounds.h/2)
    const minY = midpoint - yBuffer;
    const maxY = midpoint + yBuffer;

    let charBounds = getTopLeftCharBounds(
      img,
      minX,maxX,
      minY,maxY
    );
    if (!charBounds) break;

    // "Horizontal Correction"; too skinny
    let widthFactor = charBounds.w / avgCharBounds.w;
    if (widthFactor < 0.7) {
      charBounds.w = avgCharBounds.w;
      charBounds.x2 = charBounds.x + charBounds.w;
      
      const charBounds2 = rebound(img, charBounds);
      if (charBounds2.w / avgCharBounds.w < 0.7) { // too small
        charBounds = combineBounds(charBounds, charBounds2);
      }
      else charBounds = charBounds2;
    }

    // "Vertical Correction"; too short
    let heightFactor = charBounds.h / avgCharBounds.h;
    if (heightFactor < 0.8) { // set y bounds to same as last (ensuring that encompasses original bounds)
      charBounds.y = Math.min(charBounds.y, lastCharBounds.y);
      charBounds.y2 = Math.max(charBounds.y2, lastCharBounds.y2);
      charBounds.h = charBounds.y2 - charBounds.y;

      const charBounds2 = rebound(img, charBounds);
      if (charBounds2.h / avgCharBounds.h < 0.7) { // too small
        charBounds = combineBounds(charBounds, charBounds2);
      }
      else charBounds = charBounds2;
    }
    
    // remove any overlap
    const overlapV = getOverlappingBound(charBounds, lastCharBoundsList);
    if (overlapV) {
      charBounds.y = overlapV.y2 + 1;
      charBounds.h = charBounds.y2 - charBounds.y;
      // charBounds = rebound(img, charBounds); // adjust bounds based on new info
      const charBounds2 = rebound(img, charBounds);
      if (charBounds2.h == 0) {
        charBounds.x2 = overlapV.x2; // push forwards
        continue;
      }
      
      if (charBounds2.h / avgCharBounds.h < 0.7) { // too small
        charBounds = combineBounds(charBounds, charBounds2);
      }
      else charBounds = charBounds2;
    }

    // split horizontally first
    widthFactor = Math.round(charBounds.w / avgCharBounds.w);
    if (widthFactor > 1) {
      // console.log(widthFactor, charBounds.w / avgCharBounds.w, charBounds.w, avgCharBounds.w)
      const boundCandidates = splitBoundHorizontally(img, charBounds, widthFactor, hLookaround);
      
      // use first bound AFTER lastCharBounds (which also doesn't intersect with lastCharBounds)
      charBounds = getClosestBoundsAfter(
        lastCharBounds,
        boundCandidates
      );
    }

    // split vertically after
    heightFactor = charBounds.h / avgCharBounds.h;
    if (heightFactor > 1.3) {
      // const boundCandidates = splitBoundVertically(img, charBounds, heightFactor, vLookaroundU,vLookaroundD);
      
      // // use bound candidate closest to where character was expected
      // charBounds = getClosestBounds(
      //   lastCharBounds,
      //   boundCandidates
      // );
      charBounds = splitBoundVerticallyByReference(
        charBounds,
        lastCharBounds
      );
    }

    boundsList.push(charBounds);
    lastCharBounds = charBounds;
  }

  return boundsList;
}

// take in bounds, then change the bounds so they encompass all black pixels connected to those in the original bounds
function rebound(
  img: Jimp,
  bounds: Bounds
): Bounds {
  const blacklist = new Set<number>();
  img.scan(bounds.x,bounds.y, bounds.w, bounds.h, (x,y, idx) => {
    if (img.bitmap.data[idx] == 0xFF || blacklist.has(idx/4)) return;
    floodFillAdd(img, x,y, blacklist);
  });

  const width = img.bitmap.width;
  const height = img.bitmap.height;

  if (blacklist.size == 0) {
    return {
      x:0,y:0, x2:0,y2:0, h:0,w:0
    };
  }

  // look for min/max x/y values
  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;
  blacklist.forEach(value => {
    const x = value % width;
    const y = Math.floor(value / width);

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  return {
    x: minX,
    y: minY,
    x2: maxX,
    y2: maxY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function combineBounds(
  b1: Bounds,
  b2: Bounds
): Bounds {
  const x = Math.min(b1.x, b2.x);
  const y = Math.min(b1.y, b2.y);
  const x2 = Math.max(b1.x2, b2.x2);
  const y2 = Math.max(b1.y2, b2.y2);
  return {
    x,y,x2,y2,
    w: x2-x,
    h: y2-y
  };
}

// works by comparing top-left
function getClosestBounds(
  b1: Bounds,
  bn: Bounds[]
) {
  let distSq = Infinity;
  let closest = null;
  for (const b2 of bn) {
    const lDistSq = (b1.x - b2.x) ** 2 + (b1.y - b2.y) ** 2;
    if (lDistSq < distSq) {
      distSq = lDistSq;
      closest = b2;
    }
  }
  return closest;
}

function getClosestBoundsAfter(
  b1: Bounds,
  bn: Bounds[] // must be sorted (furthest left is the first)
) {
  for (const b2 of bn) {
    if (b2.x >= b1.x2) return b2;
  }
  return bn[bn.length-1]; // base case
}

function doBoundsOverlap(
  b1: Bounds,
  b2: Bounds
): boolean {
  return (b1.x >= b2.x && b1.x <= b2.x + b2.w || b2.x >= b1.x && b2.x <= b1.x + b1.w)
  && (b1.y >= b2.y && b1.y <= b2.y + b2.h || b2.y >= b1.y && b2.y <= b1.y + b1.h);
}

function getOverlappingBound(
  b1: Bounds,
  bn: Bounds[]
) {
  for (const b2 of bn) {
    if (doBoundsOverlap(b1, b2)) return b2;
  }
  return null;
}

export function getLineFirstCharBounds(
  img: Jimp,
  avgCharBounds: { w: number, h: number }
) {
  const lookaroundU = getSetting<number>("charBounds.lookaround.vertical-up");
  const lookaroundD = getSetting<number>("charBounds.lookaround.vertical-down");
  const yBuffer = getSetting<number>("charBounds.yBuffer.total");
  const yBufferOffset = getSetting<number>("charBounds.yBuffer.total-offset");
  
  const boundsList: Bounds[] = [];
  
  let minY = yBuffer;
  const maxY = img.bitmap.height;
  const maxX = img.bitmap.width;

  // while loop, but with built-in max itteration count
  for (let i = 0; i < 200; i++) {
    const line = getTopLine(img, minY);
    if (line >= maxY) break; // no other black pixels available

    const midpoint = line + Math.floor(avgCharBounds.h / 2);
    const bounds = getTopLeftCharBounds(img, 0,maxX, midpoint - yBuffer, midpoint + yBuffer);
    if (!bounds) break;
    minY = bounds.y2 + yBufferOffset;
    
    const heightFactor = Math.max(Math.round(bounds.h / avgCharBounds.h), 1);
    // const widthFactor = Math.max(Math.round(bounds.w / avgCharBounds.w), 1);

    const subBounds = splitBoundVertically(img, bounds, heightFactor, lookaroundU, lookaroundD);
    for (const bound of subBounds) {
      boundsList.push(bound);
    }
  }
  
  return boundsList;
}

function splitBoundVertically(
  img: Jimp,
  bounds: Bounds,
  resultant: number,
  lookaroundU: number,
  lookaroundD: number
): Bounds[] {
  if (resultant <= 1) return [bounds];

  const step = bounds.h / resultant;
  let offset = bounds.y;
  const boundsList: Bounds[] = [];
  for (let i = 0; i < resultant-1; i++) {
    
    // do lookaround
    const startY = Math.floor(Math.max(0, offset + step - lookaroundU));
    const endY = Math.ceil(Math.min(img.bitmap.height-1, offset + step + lookaroundD));
    
    let minY = step*i;
    let minWidth = Infinity;
    for (let y = endY; y >= startY; y--) { // bias split towards bottom
      let width = 0;
      for (let x = bounds.x; x <= bounds.x2; x++) {
        if (getPixelAt(img, x,y) != 0xFF) width++;
      }
      if (width < minWidth) {
        minWidth = width;
        minY = y;
      }
    }
    
    boundsList.push({
      x: bounds.x,
      y: offset,
      x2: bounds.x2,
      y2: minY,
      w: bounds.w,
      h: minY - offset
    });

    offset = minY;
  }
  boundsList.push({
    x: bounds.x,
    y: offset,
    x2: bounds.x2,
    y2: bounds.y2,
    w: bounds.w,
    h: bounds.y2 - offset
  });

  return boundsList;
}

function splitBoundVerticallyByReference(
  bounds: Bounds,
  refBounds: Bounds
): Bounds {
  const y = Math.max(bounds.y, refBounds.y);
  const y2 = Math.min(bounds.y2, refBounds.y2);

  return {
    x: bounds.x,
    x2: bounds.x2,
    y,y2,
    w: bounds.w,
    h: y2 - y
  };
}

function splitBoundHorizontally(
  img: Jimp,
  bounds: Bounds,
  resultant: number,
  lookaround: number
): Bounds[] {
  if (resultant <= 1) return [bounds];

  const step = bounds.w / resultant;
  let offset = bounds.x;
  const boundsList: Bounds[] = [];
  for (let i = 0; i < resultant-1; i++) {
    
    // do lookaround
    const startX = Math.floor(Math.max(0, offset + step - lookaround));
    const endX = Math.ceil(Math.min(img.bitmap.width-1, offset + step + lookaround));
    
    let minX = step*i;
    let minHeight = Infinity;
    for (let x = endX; x >= startX; x--) { // bias split towards the right
      let height = 0;
      for (let y = bounds.y; y <= bounds.y2; y++) {
        if (getPixelAt(img, x,y) != 0xFF) height++;
      }
      if (height < minHeight) {
        minHeight = height;
        minX = x;
      }
    }
    
    boundsList.push({
      x: offset,
      y: bounds.y,
      x2: minX,
      y2: bounds.y2,
      w: minX - offset,
      h: bounds.h
    });

    offset = minX;
  }
  boundsList.push({
    x: offset,
    y: bounds.y,
    x2: bounds.x2,
    y2: bounds.y2,
    w: bounds.x2 - offset,
    h: bounds.h
  });

  return boundsList;
}

export function getTopLine(
  img: Jimp,
  minY: number
) {
  for (let y = minY; y < img.bitmap.height; y++) {
    for (let x = 0; x < img.bitmap.width; x++) {
      const idx = 4*(x + y*img.bitmap.width);
      if (img.bitmap.data[idx] == 0) return y;
    }
  }
  return img.bitmap.height; // sentinal (effectively)
}

export function getLineCharBoundsBlind(
  img: Jimp,
  minY: number,
  maxY: number
) {
  const boundsList: Bounds[] = [];

  let minX = 0;
  const maxX = img.bitmap.width;

  // while(true), but with a limit of 200
  for (let i = 0; i < 200; i++) {
    const bounds = getTopLeftCharBounds(
      img,
      minX,maxX,
      minY,maxY
    );
    if (!bounds) break;
    boundsList.push(bounds);

    minX = bounds.x2+1; // push boundary forwards so same char is not bounded again
  }
  return boundsList;
}

export function getTopLeftCharBounds(
  img: Jimp,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) {
  const xDiff = getSetting<number>("charBounds.xDiff");

  let charMinX = Infinity;
  let charMinY = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = 4 * (x + y*img.bitmap.width);
      if (img.bitmap.data[idx] != 0) continue; // go to next

      if (x < charMinX - xDiff) {
        charMinX = x;
        charMinY = y;
      }
    }
  }

  if (charMinX == Infinity) return null;
  return floodFillBounds(img,charMinX, charMinY);
}

export function getAverageCharBounds(boundsList: Bounds[]) {
  const widths: number[] = [];
  const heights: number[] = [];

  let lastBounds = null;
  for (const bounds of boundsList) {
    if (!lastBounds) {
      lastBounds = bounds;
      continue;
    }
    const spaceDistance = bounds.x - lastBounds.x2;
    lastBounds = bounds;
    
    if (spaceDistance > bounds.w) continue; // some amount of spaces in between; not just gap between characters

    widths.push(bounds.w + spaceDistance); // account for gap between chars (much more influential than vertical gap)
    heights.push(bounds.h);

  }

  widths.sort();
  heights.sort();

  return {
    w: Math.round(getMiddle(widths)),
    h: Math.round(getMiddle(heights))
  }
}

function getMiddle(list: number[]) {
  if (list.length % 2 == 0) return (list[list.length/2] + list[list.length/2-1]) / 2
  else return list[(list.length-1)/2]
}
