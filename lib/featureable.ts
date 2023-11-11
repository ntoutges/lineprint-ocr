import Jimp = require("jimp");
import { getPixelAt } from "./jimpable.js";
import { Bounds } from "./floodable.js";

// based on difference between first pixel min and max distance from left
export function leftFlatness0(img: Jimp, smoothing:number=5, topBottomBuffer: number) {
  let firstPx: number[] = [];
  for (let y = topBottomBuffer; y < img.bitmap.height-topBottomBuffer; y++) {
    let firstPxVal = -1;
    for (let x = 0; x < img.bitmap.width; x++) {
      if (getPixelAt(img,x,y) != 0xFF) {
        firstPxVal = x;
        break;
      }
    }
    if (firstPxVal != -1) firstPx.push(firstPxVal);
  }

  firstPx.sort((a,b) => a-b);
  const end = firstPx.length-1;

  // return median of mins minus median of maxes
  return median(firstPx.slice(end-smoothing,end)) - median(firstPx.slice(0,smoothing));
}

// based on amount of pixels between imaginary vertical line at the left, and the black pixels of the character
// export function leftFlatness1(img: Jimp, smoothing:number=5, topBottomBuffer: number) {
//   let topX = 0;
//   let bottomX = 0;
//   for (let i = 0; i < smoothing; i++) {
    
//   }
// }

function stdev(vals: number[]) {
  const avg = average(vals);
  return Math.sqrt(sum(vals, (val) => { return (val - avg) ** 2 }) / (vals.length - 1));
}

function average(vals: number[]) {
  return sum(vals) / vals.length;
}

function sum(vals: number[], map: (val: number) => number = (val) => val) {
  let total = 0;
  for (const val of vals) { total += map(val); }
  return total;
}

function median(val: number[]) {
  val.sort();
  if (val.length % 2 == 0) return (val[val.length/2] + val[(val.length/2-1)])/2;
  return val[(val.length-1)/2];
}

export function isStake(
  img: Jimp,
  cx: number,
  y: number,
  bounds: Bounds,
  step: number,
  minWidth: number,
  minHeight: number
) {
  const extremeY = (step < 0) ? bounds.y-1 : bounds.y2+1;
  let lines = 0;
  for (let y2 = y+step; y2 != extremeY; y2 += step) {
    let total = 0;
    let minX = Infinity;
    let maxX = 0;
    img.scan(bounds.x,y2, bounds.w,1, (x2,_y,idx) => {
      if (img.bitmap.data[idx] != 0xFF) {
        total++;
        minX = Math.min(minX, x2);
        maxX = Math.max(maxX, x2);
      }
    });

    // out of bounds
    if (total > minWidth) break;
    if (total == 0) continue; // don't count as line if empty

    if (cx >= minX && cx <= maxX) lines++; // only add if vaguely centered
  }
  return lines >= minHeight;
}