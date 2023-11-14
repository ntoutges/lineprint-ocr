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