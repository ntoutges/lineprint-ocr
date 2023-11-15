import Jimp = require("jimp");

export function basicThreshold(
  img: Jimp,
  baseWeight: number,
  threshold: number
) {
  const greyscale = img.clone().greyscale();

  let base = 0;
  if (baseWeight != 0) { // used to adjust for lighting
    let pixelCt = greyscale.bitmap.width * greyscale.bitmap.height;
    let total = 0n; // bigint to handle massive values
    greyscale.scan(0,0, greyscale.bitmap.width, greyscale.bitmap.height, (x,y,idx) => {
      total += BigInt(Math.round(greyscale.bitmap.data[idx] * baseWeight));
    });

    base = Number(total / BigInt(pixelCt));
  }

  const width = greyscale.bitmap.width
  const height = greyscale.bitmap.height;
  greyscale.scan(0,0, width, height, (x,y,idx) => {
    if (greyscale.bitmap.data[idx] - base < threshold) { // under threshold, convert to 0s
      greyscale.bitmap.data[idx+0] = 0;
      greyscale.bitmap.data[idx+1] = 0;
      greyscale.bitmap.data[idx+2] = 0;
    }
    else { // above threshold, convert to 255s
      greyscale.bitmap.data[idx+0] = 0xFF;
      greyscale.bitmap.data[idx+1] = 0xFF;
      greyscale.bitmap.data[idx+2] = 0xFF;
    }
  });

  return greyscale;
}

// https://craftofcoding.wordpress.com/2021/10/06/thresholding-algorithms-sauvola-local/
export function sauvola(
  img: Jimp,
  radius: number,  // size of moving window
  R: number = 128, // "dynamic range of standard deviation"
  k: number = 0.5  // "constant value betwee 0.2 and 0.5"
) {
  const greyscale = img.clone().greyscale();
  const processedImg = greyscale.clone();

  greyscale.scan(
    radius,
    radius,
    greyscale.bitmap.width-radius-1,
    greyscale.bitmap.height-radius-1,
    (x,y, idx) => {
      const minX = x - radius;
      const maxX = x + radius;
      const minY = y - radius;
      const maxY = y + radius;

      let vals: number[] = [];
      for (let x2 = minX; x2 <= maxX; x2++) {
        for (let y2 = minY; y2 <= maxY; y2++) {
          const idx2 = 4 * (x2 + greyscale.bitmap.width*y2);
          vals.push(greyscale.bitmap.data[idx2]);
        }
      }

      const mean = getMean(vals);
      const stdev = getStdev(vals, mean);
      const threshold = mean * (1 + k * (stdev/R - 1));

      // console.log(greyscale.bitmap.data[idx],threshold)

      if (greyscale.bitmap.data[idx] < threshold) { // set pixel to black
        processedImg.bitmap.data[idx+0] = 0;
        processedImg.bitmap.data[idx+1] = 0;
        processedImg.bitmap.data[idx+2] = 0;
      }
      else { // set pixel to white
        processedImg.bitmap.data[idx+0] = 0xFF;
        processedImg.bitmap.data[idx+1] = 0xFF;
        processedImg.bitmap.data[idx+2] = 0xFF;
      }
    }
  );

  return processedImg.crop(
    radius,radius,
    processedImg.bitmap.width-radius, processedImg.bitmap.height-radius
  );
}

// https://wahabaftab.com/Sauvola-Thresholding-Integral-Images/
export function sauvolaOptimized(
  img: Jimp,
  radius: number,  // size of moving window
  R: number = 128, // "dynamic range of standard deviation"
  k: number = 0.5  // "constant value betwee 0.2 and 0.5"
) {
  const greyscale = img.clone().greyscale();
  const processedImg = greyscale.clone();

  const accumulator = buildIntegralImage(greyscale);
  const sqAccumulator = buildSqIntegralImage(greyscale);
  const area = (2*radius + 1) ** 2

  greyscale.scan(
    radius,
    radius,
    greyscale.bitmap.width-radius-1,
    greyscale.bitmap.height-radius-1,
    (x,y, idx) => {
      const minX = x - radius - 1;
      const maxX = x + radius;
      const minY = y - radius - 1;
      const maxY = y + radius;

      // this takes out the costly O(W^2) step

      // https://en.wikipedia.org/wiki/Summed-area_table
      const S1 = getSumFromIntegralImage(accumulator, minX,maxX, minY,maxY);
      const S2 = getSumFromIntegralImage(sqAccumulator, minX,maxX, minY,maxY);
      
      const mean = S1 / area;
      const stdev = Math.sqrt((S2 - mean) / area);
      const threshold = mean * (1 + k * (stdev/R - 1));

      // console.log(threshold)

      if (greyscale.bitmap.data[idx] < threshold) { // set pixel to black
        processedImg.bitmap.data[idx+0] = 0;
        processedImg.bitmap.data[idx+1] = 0;
        processedImg.bitmap.data[idx+2] = 0;
      }
      else { // set pixel to white
        processedImg.bitmap.data[idx+0] = 0xFF;
        processedImg.bitmap.data[idx+1] = 0xFF;
        processedImg.bitmap.data[idx+2] = 0xFF;
      }
    }
  );

  return processedImg.crop(
    radius,radius,
    processedImg.bitmap.width-radius, processedImg.bitmap.height-radius
  );
}

export function buildIntegralImage(
  img: Jimp // assume already greyscale
) {
  const accumulator = new GreyscaleInfinimage(
    img.bitmap.width,
    img.bitmap.height,
    0x00
  );

  for (let y = 0; y < img.bitmap.height; y++) {
    let accumulatedRow = 0;
    for (let x = 0; x < img.bitmap.width; x++) {
      const idx = x + y*img.bitmap.width;
      accumulatedRow += img.bitmap.data[idx];

      // add current row accumulation to previous row accumulation
      accumulator.setPixelAt(
        x,y,
        accumulatedRow + accumulator.getPixelAt(
          x,y-1
        )
      );
    }
  }
  return accumulator;
}

export function buildSqIntegralImage(
  img: Jimp // assume already greyscale
) {
  const accumulator = new GreyscaleInfinimage(
    img.bitmap.width,
    img.bitmap.height,
    0x00
  );

  for (let y = 0; y < img.bitmap.height; y++) {
    let accumulatedRow = 0;
    for (let x = 0; x < img.bitmap.width; x++) {
      const idx = x + y*img.bitmap.width;
      accumulatedRow += img.bitmap.data[idx] ** 2;

      // add current row accumulation to previous row accumulation
      accumulator.setPixelAt(
        x,y,
        accumulatedRow + accumulator.getPixelAt(
          x,y-1
        )
      );
    }
  }
  return accumulator;
}

// max + min - right - bottom
export function getSumFromIntegralImage(
  integralImage: GreyscaleInfinimage,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) {
  return integralImage.getPixelAt(maxX,maxY) + integralImage.getPixelAt(minX-1,minY-1) - integralImage.getPixelAt(maxX,minY-1) - integralImage.getPixelAt(minX-1,maxY);
}

export class GreyscaleInfinimage {
  readonly data: number[] = []
  readonly height: number;
  readonly width: number;
  constructor(
    width:number,
    height:number,
    fallback:number=0
  ) {
    this.width = width;
    this.height = height;

    // fill
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        this.data.push(fallback);
      }
    }
  }

  getIndex(x:number, y:number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
    return x+y*this.width;
  }

  getPixelAt(x:number, y:number) {
    const index = this.getIndex(x,y);
    if (index == -1) return 0;
    return this.data[index];
  }
  setPixelAt(x:number, y:number, val:number) {
    const index = this.getIndex(x,y);
    if (index == -1) return;
    this.data[index] = val;
  }
}

function getMean(vals: number[]) {
  let total = 0;
  for (const val of vals) { total += val; }
  return total / vals.length;
}

function getStdev(vals: number[], avg?: number) {
  if (!avg) avg = getMean(vals);
  let sum = 0;
  for (const val of vals) { sum += (val - avg) ** 2; }
  return Math.sqrt(sum / vals.length);
}