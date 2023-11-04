import Jimp = require("jimp");
import { getPixelAt } from "./jimpable.js";

export function leftFlatness(img: Jimp, smoothing:number=5) {
  let firstPx: number[] = [];
  for (let y = 0; y < img.bitmap.height; y++) {
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